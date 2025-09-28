import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateProfile {
  id: string;
  full_name: string;
  current_title?: string;
  current_company?: string;
  previous_company?: string;
  linkedin_url?: string;
  profile_summary?: string;
  education?: string;
  years_of_experience?: number;
  months_in_current_role?: number;
}

interface FilterRules {
  min_months_current_role?: number;
  must_have_terms?: string[];
  exclude_terms?: string[];
  exclude_location_terms?: string[];
  required_titles?: string[];
  require_top_uni?: boolean;
}

interface BatchAnalysisResult {
  candidateId: string;
  passes_role_duration_check: boolean;
  passes_must_have_terms_check: boolean;
  passes_exclude_terms_check: boolean;
  passes_location_exclusion_check: boolean;
  passes_top_university_check?: boolean;
  role_duration_score: number;
  must_have_terms_score: number;
  exclude_terms_score: number;
  location_exclusion_score: number;
  top_university_score?: number;
  reasoning: string;
  overall_pass: boolean;
}

// Retry configuration
const MAX_RETRIES = 1;
const INITIAL_DELAY = 4000; // 4 seconds
const REQUEST_TIMEOUT = 15000; // 15 seconds

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn: () => Promise<any>, retries = MAX_RETRIES): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      const delay = INITIAL_DELAY * Math.pow(2, MAX_RETRIES - retries);
      console.log(`Retrying in ${delay}ms... (${retries} attempts left)`);
      await sleep(delay);
      return retryWithBackoff(fn, retries - 1);
    }
    throw error;
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { candidates, filterRules, userId, synonyms = [] } = await req.json();

    if (!candidates || !Array.isArray(candidates) || candidates.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Candidates array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!filterRules || !userId) {
      return new Response(
        JSON.stringify({ error: 'FilterRules and userId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get top universities if required
    let topUniversities: string[] = [];
    if (filterRules.require_top_uni) {
      const { data: unis } = await supabase
        .from('top_universities')
        .select('university_name');
      topUniversities = unis?.map(u => u.university_name.toLowerCase()) || [];
    }

    // Create optimized batch prompt for multiple candidates
    // Israeli location terms (cities, regions, areas)
    const israeliLocations = [
      // Major cities (Hebrew)
      'תל אביב', 'ירושלים', 'חיפה', 'באר שבע', 'נתניה', 'רחובות', 'פתח תקווה', 'אשדוד', 'אשקלון', 
      'רמת גן', 'בני ברק', 'רעננה', 'הרצליה', 'כפר סבא', 'ראשון לציון', 'הוד השרון', 'גבעתיים',
      // Major cities (English)
      'tel aviv', 'jerusalem', 'haifa', 'beer sheva', 'netanya', 'rehovot', 'petah tikva', 'ashdod', 'ashkelon',
      'ramat gan', 'bnei brak', 'raanana', 'herzliya', 'kfar saba', 'rishon lezion', 'hod hasharon', 'givatayim',
      // Regions (Hebrew)
      'צפון', 'דרום', 'מרכז', 'שפלה', 'גליל', 'נגב', 'שרון', 'יהודה ושומרון',
      // Regions (English)
      'north', 'south', 'center', 'galilee', 'negev', 'sharon'
    ];

    // Function to extract location from candidate profile
    const extractCandidateLocation = (candidate: CandidateProfile): string => {
      const locationSources = [
        candidate.education || '',
        candidate.profile_summary || '',
        candidate.current_company || ''
      ];
      return locationSources.join(' ').toLowerCase();
    };

    // Function to check if candidate should be excluded based on location
    const shouldExcludeBasedOnLocation = (candidate: CandidateProfile, excludeLocationTerms: string[]): boolean => {
      if (!excludeLocationTerms || excludeLocationTerms.length === 0) return false;
      
      const candidateLocation = extractCandidateLocation(candidate);
      
      return excludeLocationTerms.some(excludeTerm => {
        const term = excludeTerm.toLowerCase().trim();
        if (!term) return false;
        
        // Check if the exclude term is a known Israeli location
        const isLocationTerm = israeliLocations.some(location => 
          location.toLowerCase().includes(term) || term.includes(location.toLowerCase())
        );
        
        if (isLocationTerm) {
          // Only check against candidate's location if it's a location term
          return candidateLocation.includes(term);
        }
        
        return false; // If not a location term, don't exclude based on location
      });
    };

    const createBatchPrompt = (candidates: CandidateProfile[], filterRules: FilterRules, synonyms: any[]) => {
      const synonymMap = new Map<string, string[]>();
      synonyms.forEach(s => {
        const canonical = s.canonical_term.toLowerCase();
        const variant = s.variant_term.toLowerCase();
        if (!synonymMap.has(canonical)) synonymMap.set(canonical, [canonical]);
        if (!synonymMap.has(variant)) synonymMap.set(variant, [variant]);
        synonymMap.get(canonical)!.push(variant);
        synonymMap.get(variant)!.push(canonical);
      });

      const expandTerms = (terms: string[]) => {
        const expanded = new Set<string>();
        terms.forEach(term => {
          expanded.add(term.toLowerCase());
          const syns = synonymMap.get(term.toLowerCase()) || [];
          syns.forEach(syn => expanded.add(syn));
        });
        return Array.from(expanded);
      };

      const candidatesData = candidates.map((candidate, index) => {
        return `${index + 1}. ID:${candidate.id} Name:${candidate.full_name} Title:${candidate.current_title || 'N/A'} Company:${candidate.current_company || 'N/A'} Exp:${candidate.years_of_experience || 'N/A'}y Role:${candidate.months_in_current_role || 'N/A'}m Edu:${candidate.education || 'N/A'} Summary:${(candidate.profile_summary || '').substring(0, 200)}`;
      }).join('\n');

      const parseLogicTerms = (terms: string[]): string => {
        if (!terms || terms.length === 0) return 'None';
        const input = terms.join(', ');
        
        // Check if contains logic operators
        if (input.includes(' AND ') || input.includes(' OR ') || input.includes('&') || input.includes('|')) {
          return `LOGIC:"${input}" (expanded: ${JSON.stringify(expandTerms(terms))})`;
        }
        return JSON.stringify(expandTerms(terms));
      };

      return `Analyze ${candidates.length} candidates:

RULES: MinRole:${filterRules.min_months_current_role || 0}m MustHave:${parseLogicTerms(filterRules.must_have_terms || [])} Exclude:${parseLogicTerms(filterRules.exclude_terms || [])} ExcludeLocation:${filterRules.exclude_location_terms ? JSON.stringify(filterRules.exclude_location_terms) : 'None'} Titles:${parseLogicTerms(filterRules.required_titles || [])} TopUni:${filterRules.require_top_uni ? 'Yes' : 'No'}

${candidatesData}

Return JSON array with candidateId, passes_role_duration_check, passes_must_have_terms_check, passes_exclude_terms_check, passes_location_exclusion_check, passes_top_university_check(if req), role_duration_score(1-10), must_have_terms_score(1-10), exclude_terms_score(1-10), location_exclusion_score(1-10), top_university_score(1-10,if req), reasoning(brief), overall_pass(bool).

IMPORTANT: For location exclusion - only check ExcludeLocation terms against candidate's actual location (from education, current company, or explicit location mentions), NOT against entire profile.`;
    };

    const prompt = createBatchPrompt(candidates, filterRules, synonyms);

    console.log('Sending batch analysis request to OpenAI for', candidates.length, 'candidates');

    // API call with retry logic and timeout
    const makeOpenAICall = async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
      
      try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini', // More stable model
            messages: [
              {
                role: 'system',
                 content: `You are an expert candidate screener. Analyze each candidate and return a JSON array with analysis results. Score 1-10 for each category. Use synonyms: engineer=developer, backend=server-side, frontend=client-side, senior=lead/principal.

LOGIC SUPPORT: When you see "LOGIC:" in rules, interpret AND/OR operators:
- "node AND react" means BOTH terms must be present
- "typescript OR javascript" means EITHER term is acceptable  
- "(senior AND manager) OR lead" means either (both senior AND manager) OR lead
- Default comma separation = OR logic

CRITICAL: For location exclusion (passes_location_exclusion_check) - ONLY check ExcludeLocation terms against candidate's actual location (education, current company location), NOT against skills, job titles, or other profile content. Location terms should only match location data.

Return valid JSON only.`
              },
              {
                role: 'user',
                content: prompt
              }
            ],
            max_tokens: 2000,
            temperature: 0.3
          }),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    };

    const openaiResponse = await retryWithBackoff(makeOpenAICall);

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error(`OpenAI API error (${openaiResponse.status}):`, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText.substring(0, 200)}`);
    }

    const openaiData = await openaiResponse.json();
    
    if (!openaiData.choices?.[0]?.message?.content) {
      throw new Error('Invalid response from OpenAI');
    }

    let analysisResults: BatchAnalysisResult[];
    try {
      const content = openaiData.choices[0].message.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      const jsonContent = jsonMatch ? jsonMatch[0] : content;
      analysisResults = JSON.parse(jsonContent);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', openaiData.choices[0].message.content);
      throw new Error('Failed to parse AI analysis results');
    }

    // Add deterministic location exclusion logic for reliable results
    analysisResults.forEach((result, index) => {
      const candidate = candidates.find(c => c.id === result.candidateId) || candidates[index];
      if (candidate && filterRules.exclude_location_terms) {
        const shouldExclude = shouldExcludeBasedOnLocation(candidate, filterRules.exclude_location_terms);
        result.passes_location_exclusion_check = !shouldExclude;
        result.location_exclusion_score = shouldExclude ? 1 : 10;
        if (shouldExclude) {
          result.overall_pass = false;
          result.reasoning += ' Location excluded.';
        }
      } else {
        result.passes_location_exclusion_check = true;
        result.location_exclusion_score = 10;
      }
    });

    // Add top university check if required
    if (filterRules.require_top_uni && topUniversities.length > 0) {
      analysisResults.forEach((result, index) => {
        const candidate = candidates.find(c => c.id === result.candidateId) || candidates[index];
        if (candidate?.education) {
          const education = candidate.education.toLowerCase();
          const hasTopUni = topUniversities.some(uni => 
            education.includes(uni) || 
            uni.split(' ').some(word => word.length > 3 && education.includes(word))
          );
          result.passes_top_university_check = hasTopUni;
          result.top_university_score = hasTopUni ? 10 : 1;
          result.overall_pass = result.overall_pass && hasTopUni;
        } else {
          result.passes_top_university_check = false;
          result.top_university_score = 1;
          result.overall_pass = false;
        }
      });
    }

    // Track API costs
    const tokensUsed = openaiData.usage?.total_tokens || 0;
    const costPer1kTokens = 0.00015; // gpt-4o-mini pricing
    const totalCost = (tokensUsed / 1000) * costPer1kTokens;

    await supabase.from('api_costs').insert({
      user_id: userId,
      function_name: 'batch-analyze-candidates',
      tokens_used: tokensUsed,
      cost_usd: totalCost,
    });

    console.log(`Batch analysis completed for ${candidates.length} candidates. Tokens: ${tokensUsed}, Cost: $${totalCost.toFixed(6)}`);

    return new Response(
      JSON.stringify({ 
        results: analysisResults,
        tokensUsed,
        costUsd: totalCost 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in batch-analyze-candidates function:', error);
    
    // Handle AbortError as immediate fallback
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Request aborted, triggering fallback');
      return new Response(
        JSON.stringify({ 
          error: 'AI_ANALYSIS_FAILED', 
          fallback: true,
          message: 'Request timeout, using fallback filtering' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Return fallback analysis for client-side basic filtering
    if (error instanceof Error && (error.message.includes('OpenAI') || error.message.includes('timeout'))) {
      return new Response(
        JSON.stringify({ 
          error: 'AI_ANALYSIS_FAILED', 
          fallback: true,
          message: 'AI analysis failed, using fallback filtering' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});