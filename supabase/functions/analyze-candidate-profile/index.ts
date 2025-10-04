import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CandidateProfile {
  current_title: string;
  profile_summary: string;
  education: string;
  years_of_experience: number;
  months_in_current_role: number;
}

interface FilterRules {
  min_years_experience: number;
  min_months_current_role: number;
  must_have_terms: string[];
  exclude_terms: string[];
  required_titles: string[];
  expanded_must_have_terms?: string[];
  expanded_exclude_terms?: string[];
  expanded_required_titles?: string[];
}

interface AnalysisResult {
  estimated_years_experience: number;
  estimated_months_in_role: number;
  education_level: string;
  must_have_score: number;
  exclude_terms_score: number;
  title_match_score: number;
  passes_experience_check: boolean;
  passes_role_duration_check: boolean;
  passes_must_have_check: boolean;
  passes_exclude_check: boolean;
  passes_title_check: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication first
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const authClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await authClient.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use authenticated user ID instead of accepting it from request
    const userId = user.id;

    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not found');
    }

    const { candidate, filterRules, synonyms = [] } = await req.json();

    // Input validation
    if (!candidate || typeof candidate !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Invalid candidate data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize and validate string fields
    const sanitize = (str: string | undefined, maxLength: number): string => {
      if (!str) return '';
      return str.slice(0, maxLength).replace(/[\x00-\x1F\x7F]/g, '');
    };

    candidate.current_title = sanitize(candidate.current_title, 200);
    candidate.current_company = sanitize(candidate.current_company, 200);
    candidate.previous_company = sanitize(candidate.previous_company, 200);
    candidate.profile_summary = sanitize(candidate.profile_summary, 5000);
    candidate.education = sanitize(candidate.education, 1000);
    candidate.full_name = sanitize(candidate.full_name, 200);
    console.log('Analyzing candidate:', candidate.current_title);

    // Create comprehensive text for analysis
    const candidateText = `
      Current Title: ${candidate.current_title || ''}
      Current Company: ${candidate.current_company || ''}
      Previous Company: ${candidate.previous_company || ''}
      Profile Summary: ${candidate.profile_summary || ''}
      Education: ${candidate.education || ''}
      Years of Experience: ${candidate.years_of_experience || 0}
      Months in Current Role: ${candidate.months_in_current_role || 0}
      Full Name: ${candidate.full_name || ''}
    `;

    // Create enhanced context for AI with expanded terms
    const expandedTermsContext = `
    Original Terms:
    - Must-have: ${filterRules.must_have_terms?.join(', ') || 'none'}
    - Exclude: ${filterRules.exclude_terms?.join(', ') || 'none'}  
    - Required titles: ${filterRules.required_titles?.join(', ') || 'none'}
    
    Expanded Terms (including synonyms):
    - Must-have expanded: ${filterRules.expanded_must_have_terms?.join(', ') || 'none'}
    - Exclude expanded: ${filterRules.expanded_exclude_terms?.join(', ') || 'none'}
    - Required titles expanded: ${filterRules.expanded_required_titles?.join(', ') || 'none'}
    
    CRITICAL INSTRUCTIONS:
    1. "engineer" and "developer" are EQUIVALENT roles
    2. "backend" includes: back-end, server-side, api, microservices
    3. "frontend" includes: front-end, client-side, UI
    4. Seniority hierarchy: junior < mid < senior ≤ lead ≤ principal ≤ staff
    5. Management terms: manager, team lead, head of, director are ALL management roles
    6. For exclusions: if ANY management synonym is found, exclude the candidate
    7. For titles: consider semantic equivalence and domain matches in profile summary
    `;

    const synonymsContext = synonyms.length > 0 ? `
    Database Synonyms:
    ${synonyms.map((s: any) => `- ${s.canonical_term} ↔ ${s.variant_term} (${s.category})`).join('\n')}
    ` : '';

    // Get embeddings for candidate profile
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: candidateText,
      }),
    });

    if (!embeddingResponse.ok) {
      throw new Error(`OpenAI API error: ${embeddingResponse.statusText}`);
    }

    const embeddingData = await embeddingResponse.json();
    const candidateEmbedding = embeddingData.data[0].embedding;

    // Get top universities list if required
    let topUniversitiesContext = '';
    if (filterRules.require_top_uni) {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: topUnis } = await supabaseClient
        .from('top_universities')
        .select('university_name, country');
      
      if (topUnis && topUnis.length > 0) {
        topUniversitiesContext = `
        Top Universities Requirement: ENABLED
        Recognized institutions: ${topUnis.map(u => `${u.university_name} (${u.country})`).join(', ')}
        
        UNIVERSITY MATCHING RULES:
        - Check education field for university names, abbreviations, or partial matches
        - Common abbreviations: MIT, Caltech, Technion, TAU, HUJI, BGU, UBC, McGill, ETH
        - Consider partial matches of key institution words
        - If no recognized university found, candidate should be flagged
        `;
      }
    }

    // Use GPT to analyze the candidate profile with structured output
    const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an expert HR analyst. Analyze candidate profiles and provide structured assessments.
            
            LOGIC SUPPORT: When evaluating terms, interpret AND/OR operators:
            - "node AND react" means BOTH terms must be present
            - "typescript OR javascript" means EITHER term is acceptable  
            - "(senior AND manager) OR lead" means either (both senior AND manager) OR lead
            - Default comma separation = OR logic
            
            Always respond with ONLY valid JSON in this exact format:
            {
              "estimated_years_experience": number,
              "estimated_months_in_role": number,
              "education_level": "bachelor" | "master" | "phd" | "diploma" | "none",
              "must_have_score": number,
              "exclude_terms_score": number,
              "title_match_score": number,
              "top_university_score": number
            }
            
            CRITICAL SCORING GUIDELINES:
            - must_have_score: 0-100, semantic match to expanded required terms
            - exclude_terms_score: 0-100, presence of expanded excluded terms (LOWER is better)  
            - title_match_score: 0-100, title relevance considering role+domain+seniority
            - top_university_score: 0-100, whether education is from recognized top university (100 if found, 0 if not)
            
            SEMANTIC EQUIVALENCES (treat as identical):
            - engineer ≡ developer ≡ programmer ≡ coder
            - backend ≡ back-end ≡ server-side ≡ api development
            - frontend ≡ front-end ≡ client-side ≡ UI development  
            - senior ≡ sr ≤ lead ≤ principal ≤ staff (seniority hierarchy)
            
            EXCLUSION RULES:
            - ANY management synonym (manager, lead, head of, director) should score high on exclude_terms_score
            - Be very sensitive to management terminology in titles and descriptions
            
            TITLE MATCHING:
            - Match by role (engineer≡developer) + domain (backend≡server-side) + seniority level
            - "Software Engineer" with backend experience should match "Senior Backend Engineer"
            - Consider profile summary for domain/technology context`
          },
          {
            role: 'user',
            content: `Analyze this candidate profile:
            
            ${candidateText}
            
            ${expandedTermsContext}
            
            ${synonymsContext}
            
            ${topUniversitiesContext}
            
            Filter Requirements:
            - Minimum years experience: ${filterRules.min_years_experience}
            - Minimum months in current role: ${filterRules.min_months_current_role}
            - Top university required: ${filterRules.require_top_uni ? 'YES' : 'NO'}
            
            ANALYSIS TASKS:
            1. Estimate actual experience from role progression and description
            2. Estimate time in current role from context clues  
            3. Assess education level from degrees mentioned
            4. Score must-have terms match using EXPANDED terms list (consider semantic equivalence)
            5. Score exclude terms presence using EXPANDED terms list (be strict on management terms)
            6. Score title match using expanded titles and semantic equivalence rules
            7. Score top university match: Check if education mentions any recognized institution (100 if found, 0 if not)
            
            Remember: Focus on SEMANTIC MEANING over exact keyword matching. Use the equivalence rules provided.`
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    });

    if (!analysisResponse.ok) {
      throw new Error(`OpenAI Analysis API error: ${analysisResponse.statusText}`);
    }

    const analysisData = await analysisResponse.json();
    const analysisText = analysisData.choices[0].message.content.trim();
    
    console.log('Raw analysis response:', analysisText);
    
    // Parse the JSON response
    let analysis;
    try {
      analysis = JSON.parse(analysisText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', analysisText);
      throw new Error('Invalid JSON response from analysis');
    }

    // Apply business logic based on AI analysis
    const result: AnalysisResult = {
      estimated_years_experience: analysis.estimated_years_experience,
      estimated_months_in_role: analysis.estimated_months_in_role,
      education_level: analysis.education_level,
      must_have_score: analysis.must_have_score,
      exclude_terms_score: analysis.exclude_terms_score,
      title_match_score: analysis.title_match_score,
      
      // Pass/fail determinations
      passes_experience_check: analysis.estimated_years_experience >= filterRules.min_years_experience,
      passes_role_duration_check: analysis.estimated_months_in_role >= filterRules.min_months_current_role,
      passes_must_have_check: filterRules.must_have_terms?.length > 0 ? analysis.must_have_score >= 70 : true,
      passes_exclude_check: filterRules.exclude_terms?.length > 0 ? analysis.exclude_terms_score <= 30 : true,
      passes_title_check: filterRules.required_titles?.length > 0 ? analysis.title_match_score >= 60 : true,
    };

    // Add top university check if required
    if (filterRules.require_top_uni) {
      (result as any).passes_top_university_check = analysis.top_university_score >= 80;
    }

    console.log('Analysis result:', result);

    // Initialize Supabase client for cost tracking
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Track API costs
    try {
      const analysisText = analysisData.choices[0].message.content.trim();
      const estimatedTokens = Math.ceil((candidateText.length + analysisText.length) / 4);
      const estimatedCost = (estimatedTokens / 1000000) * 0.15; // GPT-4o-mini pricing
      
      await supabaseClient.from('api_costs').insert({
        user_id: userId,
        function_name: 'analyze-candidate-profile',
        tokens_used: estimatedTokens,
        cost_usd: estimatedCost
      });
    } catch (costError) {
      console.error('Failed to track API cost:', costError);
      // Don't fail the request if cost tracking fails
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-candidate-profile function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      passes_experience_check: false,
      passes_role_duration_check: false,
      passes_must_have_check: false,
      passes_exclude_check: false,
      passes_title_check: false,
      passes_top_university_check: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});