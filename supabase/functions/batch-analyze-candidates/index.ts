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
  min_years_experience?: number;
  min_months_current_role?: number;
  must_have_terms?: string[];
  exclude_terms?: string[];
  required_titles?: string[];
  require_top_uni?: boolean;
}

interface BatchAnalysisResult {
  candidateId: string;
  passes_experience_check: boolean;
  passes_role_duration_check: boolean;
  passes_must_have_terms_check: boolean;
  passes_exclude_terms_check: boolean;
  passes_top_university_check?: boolean;
  experience_score: number;
  role_duration_score: number;
  must_have_terms_score: number;
  exclude_terms_score: number;
  top_university_score?: number;
  reasoning: string;
  overall_pass: boolean;
}

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

    // Create batch prompt for multiple candidates
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
        return `
CANDIDATE ${index + 1} (ID: ${candidate.id}):
Name: ${candidate.full_name}
Current Title: ${candidate.current_title || 'N/A'}
Current Company: ${candidate.current_company || 'N/A'}
Previous Company: ${candidate.previous_company || 'N/A'}
Years of Experience: ${candidate.years_of_experience || 'N/A'}
Months in Current Role: ${candidate.months_in_current_role || 'N/A'}
Education: ${candidate.education || 'N/A'}
Profile Summary: ${candidate.profile_summary || 'N/A'}
`;
      }).join('\n---\n');

      return `
Please analyze the following ${candidates.length} candidates against the specified filter rules.

FILTER RULES:
- Minimum Years of Experience: ${filterRules.min_years_experience || 0}
- Minimum Months in Current Role: ${filterRules.min_months_current_role || 0}
- Must-Have Terms: ${filterRules.must_have_terms ? JSON.stringify(expandTerms(filterRules.must_have_terms)) : 'None'}
- Exclude Terms: ${filterRules.exclude_terms ? JSON.stringify(expandTerms(filterRules.exclude_terms)) : 'None'}
- Required Titles: ${filterRules.required_titles ? JSON.stringify(expandTerms(filterRules.required_titles)) : 'None'}
- Top University Required: ${filterRules.require_top_uni ? 'Yes' : 'No'}

CANDIDATES:
${candidatesData}

For each candidate, provide a JSON object with:
- candidateId: the candidate's ID
- passes_experience_check: boolean
- passes_role_duration_check: boolean  
- passes_must_have_terms_check: boolean
- passes_exclude_terms_check: boolean
- passes_top_university_check: boolean (if required)
- experience_score: 1-10
- role_duration_score: 1-10
- must_have_terms_score: 1-10
- exclude_terms_score: 1-10
- top_university_score: 1-10 (if required)
- reasoning: brief explanation
- overall_pass: boolean (true if all checks pass)

Return as JSON array: [result1, result2, ...]
`;
    };

    const prompt = createBatchPrompt(candidates, filterRules, synonyms);

    console.log('Sending batch analysis request to OpenAI for', candidates.length, 'candidates');

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert candidate screening assistant. Analyze candidates thoroughly but efficiently.
            
SCORING GUIDELINES:
- Experience: 10 = exceeds requirement significantly, 7-9 = meets requirement well, 4-6 = borderline, 1-3 = below requirement
- Role Duration: 10 = very stable (2+ years), 7-9 = stable (1-2 years), 4-6 = moderate (6-12 months), 1-3 = short tenure
- Must-Have Terms: 10 = all terms clearly present, 7-9 = most terms present, 4-6 = some terms present, 1-3 = few/no terms
- Exclude Terms: 10 = no excluded terms, 1 = excluded terms found
- Top University: 10 = top university, 1 = not top university

SEMANTIC EQUIVALENCES:
- "engineer" = "developer" = "programmer" = "coder"  
- "backend" = "back-end" = "server-side" = "API"
- "frontend" = "front-end" = "client-side" = "UI"
- "senior" = "lead" = "principal" = "staff" (for seniority)
- "manager" = "lead" = "head of" = "director" (for management)

Return valid JSON array only.`
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status} - ${errorText}`);
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
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});