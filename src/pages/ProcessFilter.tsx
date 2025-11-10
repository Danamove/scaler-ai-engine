import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Filter, ArrowLeft, Play, CheckCircle, XCircle, Users, Building, RefreshCw, AlertCircle, PlayCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';
import { useCurrentJob } from '@/hooks/useCurrentJob';

// Helper functions for enhanced filtering
const normalizeCompanyName = (companyName: string): string => {
  if (!companyName) return '';
  
  return companyName
    .toLowerCase()
    .trim()
    .replace(/[.,\-()[\]]/g, ' ') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .replace(/\b(ltd|inc|llc|technologies|tech|labs|israel|corp|co|company|corporation|limited|group|systems|software|solutions)\b/gi, '') // Remove common suffixes
    .trim();
};

const getCompanyAliases = (companyName: string): string[] => {
  const normalized = normalizeCompanyName(companyName);
  const aliases = [normalized];
  
  // Add common aliases
  const aliasMap: { [key: string]: string[] } = {
    'aws': ['amazon', 'amazon web services'],
    'amazon': ['aws', 'amazon web services'],
    'meta': ['facebook'],
    'facebook': ['meta'],
    'google': ['google cloud', 'alphabet'],
    'microsoft': ['microsoft azure', 'ms'],
    'apple': ['apple inc'],
    'netflix': ['nflx']
  };
  
  Object.entries(aliasMap).forEach(([key, values]) => {
    if (normalized.includes(key) || values.some(v => normalized.includes(v))) {
      aliases.push(...values, key);
    }
  });
  
  return [...new Set(aliases)]; // Remove duplicates
};

const isCompanyMatch = (candidateCompany: string, blacklistCompany: string): boolean => {
  if (!candidateCompany || !blacklistCompany) return false;
  
  const candidateAliases = getCompanyAliases(candidateCompany);
  const blacklistAliases = getCompanyAliases(blacklistCompany);
  
  // Check for any alias match with contains logic in both directions
  for (const candAlias of candidateAliases) {
    for (const blackAlias of blacklistAliases) {
      if (candAlias.includes(blackAlias) || blackAlias.includes(candAlias)) {
        return true;
      }
    }
  }
  
  return false;
};

// University matching helpers
const normalizeUniversityName = (universityName: string): string => {
  if (!universityName) return '';
  
  return universityName
    .toLowerCase()
    .trim()
    .replace(/[.,\-()[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(university|institute|college|of|technology|the)\b/gi, '')
    .trim();
};

const isUniversityMatch = (candidateEducation: string, wantedUniversity: string): boolean => {
  if (!candidateEducation || !wantedUniversity) return false;
  
  const normalized = normalizeUniversityName(candidateEducation);
  const wantedNormalized = normalizeUniversityName(wantedUniversity);
  
  // Check if candidate's education contains the wanted university
  return normalized.includes(wantedNormalized) || wantedNormalized.includes(normalized);
};

// Import logic parser for enhanced term matching
import { checkTermsWithLogic } from '@/lib/logicParser';

const expandTermsWithSynonyms = (terms: string[], synonyms: any[]): string[] => {
  if (!terms || terms.length === 0) return [];
  
  const expandedTerms = new Set<string>();
  
  terms.forEach(term => {
    expandedTerms.add(term.toLowerCase().trim());
    
    // Find synonyms for this term
    synonyms.forEach(synonym => {
      if (synonym.canonical_term.toLowerCase() === term.toLowerCase().trim()) {
        expandedTerms.add(synonym.variant_term.toLowerCase().trim());
      }
      if (synonym.variant_term.toLowerCase() === term.toLowerCase().trim()) {
        expandedTerms.add(synonym.canonical_term.toLowerCase().trim());
      }
    });
  });
  
  return Array.from(expandedTerms);
};

const hasWordBoundaryMatch = (text: string, term: string): boolean => {
  if (!text || !term) return false;
  
  const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
  return regex.test(text);
};

const checkTermsInProfile = (candidate: any, terms: string[], synonyms: any[]): { found: boolean; matches: string[] } => {
  const expandedTerms = expandTermsWithSynonyms(terms, synonyms);
  const matches: string[] = [];
  
  const profileText = [
    candidate.current_title,
    candidate.profile_summary,
    candidate.education,
    candidate.previous_company,
    candidate.current_company,
    // Check additional skill fields from raw data
    candidate.linkedinSkillsLabel,
    candidate.linkedinSkills,
    candidate.skills,
    candidate.technologies,
    candidate.expertise,
    candidate.competencies
  ].filter(Boolean).join(' ').toLowerCase();
  
  expandedTerms.forEach(term => {
    if (hasWordBoundaryMatch(profileText, term)) {
      matches.push(term);
    }
  });
  
  return {
    found: matches.length > 0,
    matches
  };
};

// Enhanced function for logic-based term checking
const checkTermsWithLogicInProfile = (candidate: any, input: string, synonyms: any[]): { found: boolean; matches: string[] } => {
  return checkTermsWithLogic(candidate, input, synonyms);
};

interface ProcessStats {
  totalCandidates: number;
  processed: number;
  stage1Passed: number;
  stage2Passed: number;
  finalResults: number;
}

interface ProcessState {
  estimatedTime?: number;
  startTime?: number;
  batchesProcessed: number;
  totalBatches: number;
  currentBatch: number;
}

const ProcessFilter = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  const { jobId, loading: jobLoading } = useCurrentJob();
  
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState<ProcessStats>({
    totalCandidates: 0,
    processed: 0,
    stage1Passed: 0,
    stage2Passed: 0,
    finalResults: 0
  });
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [completed, setCompleted] = useState(false);
  const [processState, setProcessState] = useState<ProcessState>({
    batchesProcessed: 0,
    totalBatches: 0,
    currentBatch: 0
  });
  const [cancelled, setCancelled] = useState(false);

  useEffect(() => {
    if (!loading && !jobLoading && !user) {
      navigate('/auth');
    } else if (!loading && !jobLoading && user && jobId) {
      loadInitialStats();
    }
  }, [user, loading, jobLoading, jobId, navigate]);

  const loadInitialStats = async () => {
    if (!user) return;

    try {
      // Count only candidates for this specific job
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', getActiveUserId())
        .eq('job_id', jobId!);

      setStats(prev => ({ ...prev, totalCandidates: totalCandidates || 0 }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  // Cancel function
  const cancelProcessing = () => {
    setCancelled(true);
    setProcessing(false);
    setCurrentStep('Cancelled by user');
    toast({
      title: "Processing Cancelled",
      description: "The filtering process has been cancelled.",
    });
  };

  // Format time helper
  const formatTime = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  const processFiltering = async () => {
    if (!user || processing) return;

    console.log('Starting filtering process...');
    setProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing...');
    setCompleted(false);
    setCancelled(false);

    try {
      // Get filter rules first
      console.log('Loading filter rules...');
      setCurrentStep('Loading data...');
      setProgress(10);

      const { data: filterRulesArray, error: filterRulesError } = await supabase
        .from('filter_rules')
        .select('*')
        .eq('user_id', getActiveUserId())
        .order('updated_at', { ascending: false })
        .limit(1);

      const filterRules = filterRulesArray?.[0];
      const currentJobId = jobId!;

      if (filterRulesError) {
        console.error('Error loading filter rules:', filterRulesError);
        throw filterRulesError;
      }

      // Load all candidates with pagination to bypass 1000 row limit
      console.log('Loading candidates...');
      let allCandidates = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data: candidatesPage, error: candidatesError } = await supabase
          .from('raw_data')
          .select('*')
          .eq('user_id', getActiveUserId())
          .eq('job_id', currentJobId)
          .range(offset, offset + pageSize - 1);

        if (candidatesError) {
          console.error('Error loading candidates:', candidatesError);
          throw candidatesError;
        }

        if (candidatesPage && candidatesPage.length > 0) {
          allCandidates.push(...candidatesPage);
          offset += pageSize;
          hasMore = candidatesPage.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const candidates = allCandidates;

      if (!candidates || !filterRules) {
        throw new Error('Missing candidates or filter configuration');
      }

      console.log(`Found ${candidates.length} candidates and filter rules:`, filterRules);

      // Get built-in lists and synonyms
      setCurrentStep('Loading built-in lists and synonyms...');
      setProgress(20);

      const { data: synonyms } = await supabase
        .from('synonyms')
        .select('*');

      const { data: notRelevantCompanies } = await supabase
        .from('not_relevant_companies')
        .select('company_name');

      const { data: targetCompanies } = await supabase
        .from('target_companies')
        .select('company_name');

      // Get user lists (filtered by job_id for consistency)
      const { data: blacklistCompanies } = await supabase
        .from('user_blacklist')
        .select('company_name')
        .eq('user_id', getActiveUserId())
        .eq('job_id', currentJobId);

      const { data: wantedCompanies } = await supabase
        .from('user_wanted_companies')
        .select('company_name')
        .eq('user_id', getActiveUserId())
        .eq('job_id', currentJobId);

      const { data: wantedUniversities } = await supabase
        .from('user_wanted_universities')
        .select('university_name')
        .eq('user_id', getActiveUserId())
        .eq('job_id', currentJobId);

      const { data: pastCandidates } = await supabase
        .from('user_past_candidates')
        .select('candidate_name')
        .eq('user_id', getActiveUserId())
        .eq('job_id', currentJobId);

      console.log('🔍 Past Candidates Debug:', {
        jobId: currentJobId,
        count: pastCandidates?.length || 0,
        sample: pastCandidates?.slice(0, 3).map(p => p.candidate_name) || []
      });

      console.log('Loaded lists:', {
        synonyms: synonyms?.length || 0,
        notRelevantCompanies: notRelevantCompanies?.length || 0,
        targetCompanies: targetCompanies?.length || 0,
        blacklistCompanies: blacklistCompanies?.length || 0,
        wantedCompanies: wantedCompanies?.length || 0,
        wantedUniversities: wantedUniversities?.length || 0,
        pastCandidates: pastCandidates?.length || 0
      });

      // Clear existing results for the user
      const { error: deleteError } = await supabase
        .from('filtered_results')
        .delete()
        .eq('user_id', getActiveUserId())
        .eq('job_id', currentJobId);

      if (deleteError) {
        console.error('Error clearing previous results:', deleteError);
      }

      setCurrentStep('Stage 1: Deterministic filtering...');
      setProgress(30);

      let stage1Passed = 0;
      let stage2Passed = 0;
      let finalResults = 0;

      const results = [];
      const stage1PassedCandidates = [];

      console.log('Starting Stage 1 deterministic filtering...');

      // STAGE 1: Process all candidates through deterministic filters first
      for (let i = 0; i < candidates.length; i++) {
        if (cancelled) break;

        const candidate = candidates[i];
        let stage1Pass = true;
        const filterReasons = [];

        // Enhanced blacklist check with normalization and aliases
        const blacklist = blacklistCompanies?.map(b => b.company_name) || [];
        let blacklistMatch = null;
        
        if (candidate.current_company) {
          for (const blacklistCompany of blacklist) {
            if (isCompanyMatch(candidate.current_company, blacklistCompany)) {
              blacklistMatch = blacklistCompany;
              break;
            }
          }
          
          if (blacklistMatch) {
            stage1Pass = false;
            filterReasons.push(`Blacklisted company: ${blacklistMatch}`);
            console.log(`Blacklist match - Candidate: ${candidate.full_name}, Company: ${candidate.current_company}, Matched: ${blacklistMatch}`);
          }
        }

        // Check past candidates
        if (stage1Pass) {
          const pastCandidateNames = pastCandidates?.map(p => p.candidate_name.toLowerCase()) || [];
          if (candidate.full_name && pastCandidateNames.includes(candidate.full_name.toLowerCase())) {
            stage1Pass = false;
            filterReasons.push('Past candidate');
          }
        }

        // Check NotRelevant companies (if enabled)
        if (stage1Pass && filterRules.use_not_relevant_filter) {
          const notRelevantList = notRelevantCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase() || '';
          const previousCompany = candidate.previous_company?.toLowerCase() || '';
          
          if (notRelevantList.some(company => 
            currentCompany.includes(company) || previousCompany.includes(company) ||
            company.includes(currentCompany) || company.includes(previousCompany)
          )) {
            stage1Pass = false;
            filterReasons.push('NotRelevant company');
          }
        }

        // Check wanted companies + target companies (combined logic)
        if (stage1Pass) {
          const userWantedList = wantedCompanies?.map(w => w.company_name) || [];
          const combinedWantedList = [...userWantedList];
          
          // Add target companies ONLY if the filter is enabled AND user has wanted companies
          if (filterRules.use_target_companies_filter && userWantedList.length > 0) {
            const targetList = targetCompanies?.map(t => t.company_name) || [];
            combinedWantedList.push(...targetList);
          }
          
          // If user has wanted companies filter enabled, filter by combined list
          if (filterRules.use_wanted_companies_filter && userWantedList.length > 0) {
            const currentCompany = candidate.current_company || '';
            const previousCompany = candidate.previous_company || '';
            
            let matchFound = false;
            
            for (const wantedCompany of combinedWantedList) {
              if (isCompanyMatch(currentCompany, wantedCompany) || 
                  isCompanyMatch(previousCompany, wantedCompany)) {
                matchFound = true;
                break;
              }
            }
            
            if (!matchFound) {
              stage1Pass = false;
              filterReasons.push('Not in wanted companies list');
              console.log(`Wanted companies check failed - Candidate: ${candidate.full_name}, Current: ${currentCompany}, Previous: ${previousCompany}`);
            }
          }
          // If no user wanted companies but target filter is ON, use original target logic
          else if (filterRules.use_target_companies_filter) {
            const targetList = targetCompanies?.map(t => t.company_name) || [];
            if (targetList.length > 0) {
              const currentCompany = candidate.current_company || '';
              const previousCompany = candidate.previous_company || '';
              
              let isFromTargetCompany = false;
              
              for (const targetCompany of targetList) {
                if (isCompanyMatch(currentCompany, targetCompany) || 
                    isCompanyMatch(previousCompany, targetCompany)) {
                  isFromTargetCompany = true;
                  break;
                }
              }
              
              if (!isFromTargetCompany) {
                stage1Pass = false;
                filterReasons.push('Not from target company');
              }
            }
          }
        }

        // Check wanted universities filter
        if (stage1Pass) {
          const userWantedUniversities = wantedUniversities?.map(u => u.university_name) || [];
          
          if (filterRules.use_wanted_universities_filter && userWantedUniversities.length > 0) {
            const candidateEducation = candidate.education || '';
            
            let universityMatchFound = false;
            
            for (const wantedUni of userWantedUniversities) {
              if (isUniversityMatch(candidateEducation, wantedUni)) {
                universityMatchFound = true;
                break;
              }
            }
            
            if (!universityMatchFound) {
              stage1Pass = false;
              filterReasons.push('Not from wanted universities list');
              console.log(`Wanted universities check failed - Candidate: ${candidate.full_name}, Education: ${candidateEducation}`);
            }
          }
        }

        if (stage1Pass) {
          stage1Passed++;
          stage1PassedCandidates.push({
            candidate,
            filterReasons
          });
        } else {
          // Save failed Stage 1 result
          results.push({
            raw_data_id: candidate.id,
            user_id: getActiveUserId(),
            job_id: currentJobId,
            stage_1_passed: false,
            stage_2_passed: false,
            filter_reasons: filterReasons
          });
        }

        // Update progress for Stage 1
        const stage1Progress = Math.floor(30 + (i + 1) / candidates.length * 20);
        setProgress(stage1Progress);
        setStats(prev => ({ 
          ...prev, 
          processed: i + 1,
          stage1Passed: stage1Passed
        }));
      }

      console.log(`Stage 1 complete: ${stage1PassedCandidates.length} candidates passed out of ${candidates.length}`);

      // STAGE 2: AI Analysis on stage1 passed candidates with optimized parallel processing
      if (stage1PassedCandidates.length > 0 && !cancelled) {
        console.log(`Starting Stage 2 AI analysis for ${stage1PassedCandidates.length} candidates...`);
        setCurrentStep(`Stage 2: AI analysis (0/${stage1PassedCandidates.length})...`);
        setProgress(60);

        // Optimized batch processing: smaller batches for stability
        const batchSize = Math.min(15, Math.ceil(stage1PassedCandidates.length / 6)); // Reduced batch size
        const maxParallelBatches = 3;
        const totalBatches = Math.ceil(stage1PassedCandidates.length / batchSize);
        let processedCount = 0;
        
        // Initialize process state
        const startTime = Date.now();
        setProcessState({
          startTime,
          totalBatches,
          batchesProcessed: 0,
          currentBatch: 0,
          estimatedTime: 0
        });

        // Batch processing function with retry and fallback
        const processBatch = async (batchCandidates: any[], batchNum: number) => {
          try {
            console.log(`Processing batch ${batchNum} with ${batchCandidates.length} candidates`);
            
            // Add client-side timeout of 20 seconds
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Client timeout')), 20000)
            );
            
            const invokePromise = supabase.functions.invoke(
              'batch-analyze-candidates',
              {
                body: {
                  candidates: batchCandidates.map(item => item.candidate),
                  filterRules,
                  userId: getActiveUserId(),
                  synonyms: synonyms || []
                }
              }
            );

            const { data: batchResults, error: batchError } = await Promise.race([
              invokePromise,
              timeoutPromise
            ]) as any;

            if (batchError) throw batchError;
            if (batchResults?.error === 'AI_ANALYSIS_FAILED') {
              throw new Error('AI analysis failed, using fallback');
            }
            
            return { success: true, results: batchResults, batch: batchCandidates };
          } catch (error) {
            console.error(`Batch ${batchNum} failed:`, error);
            return { success: false, error, batch: batchCandidates };
          }
        };

        // Process batches in parallel groups
        for (let i = 0; i < stage1PassedCandidates.length; i += batchSize * maxParallelBatches) {
          if (cancelled) break;
          
          // Create parallel batch promises
          const parallelBatches = [];
          for (let j = 0; j < maxParallelBatches && (i + j * batchSize) < stage1PassedCandidates.length; j++) {
            const batchStart = i + j * batchSize;
            const batchEnd = Math.min(batchStart + batchSize, stage1PassedCandidates.length);
            const batch = stage1PassedCandidates.slice(batchStart, batchEnd);
            
            if (batch.length > 0) {
              parallelBatches.push(processBatch(batch, Math.floor(batchStart / batchSize) + 1));
            }
          }

          // Execute batches in parallel
          const batchResults = await Promise.allSettled(parallelBatches);
          
          // Process results
          for (const result of batchResults) {
            if (result.status === 'fulfilled') {
              const { success, results: batchData, batch, error } = result.value;
              
              if (success && batchData?.results) {
                // Process successful AI results
                batchData.results.forEach((aiResult: any, index: number) => {
                  const item = batch[index];
                  if (item && aiResult) {
                    const candidate = item.candidate;
                    const filterReasons = [...item.filterReasons];
                    let stage2Pass = aiResult.overall_pass;
                    
                    // Generate detailed rejection reasons based on AI analysis
                    if (!aiResult.passes_role_duration_check) {
                      filterReasons.push(`Insufficient role duration: ${candidate.months_in_current_role || 0} months (required: ${filterRules.min_months_current_role || 0})`);
                    }
                    if (!aiResult.passes_must_have_terms_check && filterRules.must_have_terms && filterRules.must_have_terms.length > 0) {
                      filterReasons.push(`Missing required terms: ${filterRules.must_have_terms.join(', ')}`);
                    }
                    if (!aiResult.passes_exclude_terms_check && filterRules.exclude_terms && filterRules.exclude_terms.length > 0) {
                      filterReasons.push(`Contains excluded terms: ${filterRules.exclude_terms.join(', ')}`);
                    }
                    if (!aiResult.passes_location_exclusion_check && filterRules.exclude_location_terms && filterRules.exclude_location_terms.length > 0) {
                      filterReasons.push(`Excluded location detected: ${filterRules.exclude_location_terms.join(', ')}`);
                    }
                    if (filterRules.require_top_uni && aiResult.passes_top_university_check === false) {
                      filterReasons.push('Top university requirement not met');
                    }
                    
                    // Deterministic override to correct AI false negatives/positives
                    let aiPasses_must_have_terms_check = aiResult.passes_must_have_terms_check;
                    let aiPasses_exclude_terms_check = aiResult.passes_exclude_terms_check;
                    
                    // Check must-have terms deterministically and override AI if needed
                    if (filterRules.must_have_terms && filterRules.must_have_terms.length > 0) {
                      const mustHaveCheck = checkTermsInProfile(candidate, filterRules.must_have_terms, synonyms || []);
                      
                      if (!aiPasses_must_have_terms_check && mustHaveCheck.found) {
                        // AI said no, but we found the terms - override AI (positive override)
                        aiPasses_must_have_terms_check = true;
                        // Remove the AI's rejection reason
                        const reasonIndex = filterReasons.findIndex(r => r.includes('Missing required terms'));
                        if (reasonIndex > -1) {
                          filterReasons.splice(reasonIndex, 1);
                        }
                        console.log(`Deterministic override (positive): Found required terms [${mustHaveCheck.matches.join(', ')}] for candidate ${candidate.full_name}`);
                      } else if (aiPasses_must_have_terms_check && !mustHaveCheck.found) {
                        // AI said yes, but deterministic didn't find terms - log but don't override
                        // This could be due to incomplete text, synonyms, or formatting differences
                        console.log(`DEBUG: AI approved must-have terms but deterministic check failed for candidate ${candidate.full_name}. Terms: [${filterRules.must_have_terms.join(', ')}]. This is expected and we trust the AI decision.`);
                      }
                    }
                    
                    // Check exclude terms deterministically and override AI if needed  
                    if (filterRules.exclude_terms && filterRules.exclude_terms.length > 0) {
                      const excludeCheck = checkTermsInProfile(candidate, filterRules.exclude_terms, synonyms || []);
                      
                      if (aiPasses_exclude_terms_check && excludeCheck.found) {
                        // AI said pass, but we found excluded terms - override AI
                        aiPasses_exclude_terms_check = false;
                        filterReasons.push(`Contains excluded terms: ${excludeCheck.matches.join(', ')}`);
                        console.log(`Deterministic override: Found excluded terms [${excludeCheck.matches.join(', ')}] for candidate ${candidate.full_name}`);
                      } else if (!aiPasses_exclude_terms_check && !excludeCheck.found) {
                        // AI said fail, but we don't find excluded terms - override AI
                        aiPasses_exclude_terms_check = true;
                        // Remove the AI's rejection reason
                        const reasonIndex = filterReasons.findIndex(r => r.includes('Contains excluded terms'));
                        if (reasonIndex > -1) {
                          filterReasons.splice(reasonIndex, 1);
                        }
                        console.log(`Deterministic override: No excluded terms found for candidate ${candidate.full_name}`);
                      }
                    }
                    
                    // Recalculate stage2Pass based on corrected flags
                    stage2Pass = aiResult.passes_role_duration_check && 
                                aiPasses_must_have_terms_check && 
                                aiPasses_exclude_terms_check && 
                                aiResult.passes_location_exclusion_check && 
                                (!filterRules.require_top_uni || aiResult.passes_top_university_check !== false);
                    
                    // Check Target companies (moved from Stage 1 to Stage 2)
                    if (stage2Pass && filterRules.use_target_companies_filter) {
                      const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
                      const currentCompany = candidate.current_company?.toLowerCase() || '';
                      const previousCompany = candidate.previous_company?.toLowerCase() || '';
                      
                      const hasTargetCompany = targetList.some(company => 
                        currentCompany.includes(company) || previousCompany.includes(company) ||
                        company.includes(currentCompany) || company.includes(previousCompany)
                      );
                      
                      if (!hasTargetCompany) {
                        stage2Pass = false;
                        filterReasons.push('No target company match');
                      }
                    }
                    
                    if (stage2Pass) stage2Passed++;
                    
                    results.push({
                      raw_data_id: candidate.id,
                      user_id: getActiveUserId(),
                      job_id: currentJobId,
                      stage_1_passed: true,
                      stage_2_passed: stage2Pass,
                      filter_reasons: filterReasons
                    });
                  }
                });
              } else {
                // Fallback for failed batches - detailed checks with specific reasons
                batch.forEach((item: any) => {
                  const candidate = item.candidate;
                  const filterReasons = [...item.filterReasons];
                  let stage2Pass = true;

                  // Role duration check
                  if (candidate.months_in_current_role < (filterRules.min_months_current_role || 0)) {
                    stage2Pass = false;
                    filterReasons.push(`Insufficient role duration: ${candidate.months_in_current_role || 0} months (required: ${filterRules.min_months_current_role || 0})`);
                  }

                  // Enhanced must have terms check with logic support
                  if (stage2Pass && filterRules.must_have_terms && filterRules.must_have_terms.length > 0) {
                    const mustHaveInput = filterRules.must_have_terms.join(', ');
                    const mustHaveCheck = checkTermsWithLogicInProfile(candidate, mustHaveInput, synonyms || []);
                    
                    if (!mustHaveCheck.found) {
                      stage2Pass = false;
                      filterReasons.push(`Missing required terms: ${mustHaveInput}`);
                    }
                  }

                  // Enhanced exclude terms check with logic support
                  if (stage2Pass && filterRules.exclude_terms && filterRules.exclude_terms.length > 0) {
                    const excludeInput = filterRules.exclude_terms.join(', ');
                    const excludeCheck = checkTermsWithLogicInProfile(candidate, excludeInput, synonyms || []);
                    
                    if (excludeCheck.found) {
                      stage2Pass = false;
                      filterReasons.push(`Contains excluded terms: ${excludeCheck.matches.join(', ')}`);
                    }
                  }

                  // Location exclusion check
                  if (stage2Pass && filterRules.exclude_location_terms && filterRules.exclude_location_terms.length > 0) {
                    const candidateLocation = [
                      candidate.education,
                      candidate.profile_summary,
                      candidate.current_company
                    ].join(' ').toLowerCase();
                    
                    const hasExcludedLocation = filterRules.exclude_location_terms.some(term => 
                      candidateLocation.includes(term.toLowerCase())
                    );
                    
                    if (hasExcludedLocation) {
                      stage2Pass = false;
                      filterReasons.push(`Excluded location detected: ${filterRules.exclude_location_terms.join(', ')}`);
                    }
                  }

                  // Top university check
                  if (stage2Pass && filterRules.require_top_uni) {
                    // Simple fallback - assume no top uni if no education data
                    if (!candidate.education) {
                      stage2Pass = false;
                      filterReasons.push('Top university requirement not met');
                    }
                  }

                  // Target companies check (moved from Stage 1)
                  if (stage2Pass && filterRules.use_target_companies_filter) {
                    const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
                    const currentCompany = candidate.current_company?.toLowerCase() || '';
                    const previousCompany = candidate.previous_company?.toLowerCase() || '';
                    
                    const hasTargetCompany = targetList.some(company => 
                      currentCompany.includes(company) || previousCompany.includes(company) ||
                      company.includes(currentCompany) || company.includes(previousCompany)
                    );
                    
                    if (!hasTargetCompany) {
                      stage2Pass = false;
                      filterReasons.push('No target company match');
                    }
                  }

                  // Target companies check (moved from Stage 1)
                  if (stage2Pass && filterRules.use_target_companies_filter) {
                    const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
                    const currentCompany = candidate.current_company?.toLowerCase() || '';
                    const previousCompany = candidate.previous_company?.toLowerCase() || '';
                    
                    const hasTargetCompany = targetList.some(company => 
                      currentCompany.includes(company) || previousCompany.includes(company) ||
                      company.includes(currentCompany) || company.includes(previousCompany)
                    );
                    
                    if (!hasTargetCompany) {
                      stage2Pass = false;
                      filterReasons.push('No target company match');
                    }
                  }

                  if (stage2Pass) stage2Passed++;
                  
                  results.push({
                    raw_data_id: candidate.id,
                    user_id: getActiveUserId(),
                    job_id: currentJobId,
                    stage_1_passed: true,
                    stage_2_passed: stage2Pass,
                    filter_reasons: filterReasons
                  });
                });
              }

              processedCount += batch.length;
              
              // Update progress
              const progressPercent = 60 + (processedCount / stage1PassedCandidates.length) * 30;
              setProgress(progressPercent);
              setCurrentStep(`Stage 2: AI analysis (${processedCount}/${stage1PassedCandidates.length})...`);
              
              // Update batch and time estimation
              const newBatchesProcessed = Math.floor(processedCount / batchSize) + 1;
              const elapsed = Date.now() - startTime;
              const remaining = stage1PassedCandidates.length - processedCount;
              const estimatedRemaining = remaining > 0 && processedCount > 0 ? (elapsed / processedCount) * remaining : 0;
              
              setProcessState(prev => ({
                ...prev,
                batchesProcessed: newBatchesProcessed,
                estimatedTime: estimatedRemaining
              }));
              
              setStats(prev => ({
                ...prev,
                processed: processedCount,
                stage2Passed: stage2Passed
              }));
            }
          }
        }
      }

      // Update final results count
      finalResults = stage2Passed;

      if (!cancelled) {
        // Save all results to database
        setCurrentStep('Saving results...');
        setProgress(90);

        if (results.length > 0) {
          const { error: insertError } = await supabase
            .from('filtered_results')
            .insert(results);

          if (insertError) {
            console.error('Error saving results:', insertError);
            throw insertError;
          }
        }

        // Final update
        setStats(prev => ({
          ...prev,
          processed: candidates.length,
          stage1Passed,
          stage2Passed,
          finalResults
        }));
        setProgress(100);
        setCurrentStep('Complete!');
        setCompleted(true);

        console.log('Filtering completed successfully!');
        console.log(`Final results: ${finalResults} candidates passed all stages out of ${candidates.length} total`);

        toast({
          title: "Filtering Complete!",
          description: `Processed ${candidates.length} candidates. ${finalResults} candidates passed all filters.`,
        });
      }

    } catch (error) {
      console.error('Processing failed:', error);
      toast({
        title: "Processing Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
      setCancelled(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">Process Filtering</h1>
              <p className="text-muted-foreground">
                {isImpersonating && impersonatedUser ? (
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Processing for: {impersonatedUser.email}
                  </span>
                ) : (
                  `Processing for: ${getActiveUserEmail()}`
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Enhanced Progress Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  Processing Status
                </CardTitle>
                {processing && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={cancelProcessing}
                    className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                  >
                    Cancel
                  </Button>
                )}
              </div>
              <CardDescription>
                Current filtering progress and statistics
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="text-center p-3 bg-white border rounded-lg">
                  <div className="text-2xl font-bold text-primary">{stats.totalCandidates}</div>
                  <div className="text-sm text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-white border rounded-lg">
                  <div className="text-2xl font-bold text-blue-600">{stats.processed}</div>
                  <div className="text-sm text-muted-foreground">Processed</div>
                </div>
                <div className="text-center p-3 bg-white border rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{stats.stage1Passed}</div>
                  <div className="text-sm text-muted-foreground">Stage 1 ✓</div>
                </div>
                <div className="text-center p-3 bg-white border rounded-lg">
                  <div className="text-2xl font-bold text-orange-600">{stats.stage2Passed}</div>
                  <div className="text-sm text-muted-foreground">Stage 2 ✓</div>
                </div>
                <div className="text-center p-3 bg-white border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">{stats.finalResults}</div>
                  <div className="text-sm text-muted-foreground">Final Results</div>
                </div>
              </div>

              {processing && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      {currentStep}
                    </span>
                    {processState.estimatedTime && processState.estimatedTime > 0 ? (
                      <span className="text-muted-foreground">
                        ~{formatTime(processState.estimatedTime)} remaining
                      </span>
                    ) : processing && processState.totalBatches > 0 ? (
                      <span className="text-muted-foreground">
                        Calculating...
                      </span>
                    ) : null}
                  </div>
                  <Progress value={progress} className="w-full" />
                  <div className="text-xs text-muted-foreground text-center">
                    {progress.toFixed(1)}% complete
                    {processState.totalBatches > 0 && (
                      <span className="ml-2">
                        • Batch {processState.batchesProcessed}/{processState.totalBatches}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {completed && (
                <div className="text-center space-y-3">
                  <div className="flex items-center justify-center gap-2 text-green-600">
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-medium">Processing Complete!</span>
                  </div>
                  <Link to="/results">
                    <Button className="w-full">
                      View Results ({stats.finalResults} candidates)
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Section */}
          <Card>
            <CardHeader>
              <CardTitle>Start Processing</CardTitle>
              <CardDescription>
                Begin the automated filtering process for all uploaded candidates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {stats.totalCandidates === 0 ? (
                <div className="text-center space-y-4 p-8">
                  <AlertCircle className="h-12 w-12 mx-auto text-yellow-500" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">No candidates found</h3>
                    <p className="text-muted-foreground mb-4">
                      You need to upload candidate data before you can start filtering.
                    </p>
                    <Link to="/upload">
                      <Button>
                        <Users className="h-4 w-4 mr-2" />
                        Upload Candidates
                      </Button>
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100 text-blue-600">
                        <Users className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-medium">Ready to process</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.totalCandidates} candidates found
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={processFiltering} 
                      disabled={processing || stats.totalCandidates === 0}
                      size="lg"
                    >
                      {processing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <PlayCircle className="h-4 w-4 mr-2" />
                          Start Filtering Process
                        </>
                      )}
                    </Button>
                  </div>

                  {completed && (
                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-green-100 text-green-600">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-green-800">Processing completed successfully!</p>
                          <p className="text-sm text-green-600">
                            {stats.finalResults} candidates passed all filtering stages
                          </p>
                        </div>
                      </div>
                      <Link to="/results">
                        <Button variant="default">
                          View Results
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500" />
                Performance Optimizations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <p><strong>Parallel Processing:</strong> Up to 3 batches processed simultaneously</p>
                  <p><strong>Optimized Batches:</strong> 15 candidates per batch for stability</p>
                  <p><strong>Stable AI Model:</strong> GPT-4o-Mini for reliable analysis</p>
                </div>
                <div className="space-y-2">
                  <p><strong>Retry Logic:</strong> Automatic retries with exponential backoff</p>
                  <p><strong>Fallback System:</strong> Basic checks if AI analysis fails</p>
                  <p><strong>Progress Tracking:</strong> Real-time updates with time estimates</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ProcessFilter;