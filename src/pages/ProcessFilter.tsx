import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Filter, ArrowLeft, Play, CheckCircle, XCircle, Users, Building } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAdminImpersonation } from '@/hooks/useAdminImpersonation';

interface ProcessStats {
  totalCandidates: number;
  processed: number;
  stage1Passed: number;
  stage2Passed: number;
  finalResults: number;
}

const ProcessFilter = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getActiveUserId, getActiveUserEmail, isImpersonating, impersonatedUser } = useAdminImpersonation();
  
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

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    } else if (user) {
      loadInitialStats();
    }
  }, [user, loading, navigate]);

  const loadInitialStats = async () => {
    if (!user) return;

    try {
      // Get total candidates
      const { count: totalCandidates } = await supabase
        .from('raw_data')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats(prev => ({ ...prev, totalCandidates: totalCandidates || 0 }));
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const processFiltering = async () => {
    if (!user || processing) return;

    console.log('Starting filtering process...');
    setProcessing(true);
    setProgress(0);
    setCurrentStep('Initializing...');

    try {
      // Get candidates and filter rules
      console.log('Loading data...');
      setCurrentStep('Loading data...');
      setProgress(10);

      // Load all candidates with pagination to bypass 1000 row limit
      let allCandidates = [];
      let hasMore = true;
      let offset = 0;
      const pageSize = 1000;

      while (hasMore) {
        const { data: candidatesPage, error: candidatesError } = await supabase
          .from('raw_data')
          .select('*')
          .eq('user_id', user.id)
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

      const { data: filterRulesArray, error: filterRulesError } = await supabase
        .from('filter_rules')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1);

      const filterRules = filterRulesArray?.[0];

      if (filterRulesError) {
        console.error('Error loading filter rules:', filterRulesError);
        throw filterRulesError;
      }

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

      // Get user lists
      const { data: blacklistCompanies } = await supabase
        .from('user_blacklist')
        .select('company_name')
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      const { data: pastCandidates } = await supabase
        .from('user_past_candidates')
        .select('candidate_name')
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      console.log('Loaded lists:', {
        synonyms: synonyms?.length || 0,
        notRelevantCompanies: notRelevantCompanies?.length || 0,
        targetCompanies: targetCompanies?.length || 0,
        blacklistCompanies: blacklistCompanies?.length || 0,
        pastCandidates: pastCandidates?.length || 0
      });

      // Built-in synonym maps for better matching
      const builtInSynonyms = {
        titles: [
          { canonical: 'engineer', variants: ['developer', 'dev', 'programmer', 'coder'] },
          { canonical: 'software engineer', variants: ['software developer', 'software dev', 'application developer', 'app developer'] },
          { canonical: 'backend engineer', variants: ['backend developer', 'server-side engineer', 'server-side developer', 'back-end engineer', 'back-end developer'] },
          { canonical: 'frontend engineer', variants: ['frontend developer', 'front-end engineer', 'front-end developer', 'ui engineer', 'ui developer'] },
          { canonical: 'full stack engineer', variants: ['full stack developer', 'fullstack engineer', 'fullstack developer', 'full-stack engineer', 'full-stack developer'] },
          { canonical: 'data engineer', variants: ['data developer', 'big data engineer', 'etl engineer', 'pipeline engineer'] },
          { canonical: 'devops engineer', variants: ['devops developer', 'infrastructure engineer', 'site reliability engineer', 'sre', 'cloud engineer'] },
          { canonical: 'architect', variants: ['technical architect', 'solution architect', 'systems architect', 'software architect'] }
        ],
        domains: [
          { canonical: 'backend', variants: ['back-end', 'back end', 'server-side', 'server side', 'api', 'microservices'] },
          { canonical: 'frontend', variants: ['front-end', 'front end', 'client-side', 'client side', 'ui', 'user interface'] },
          { canonical: 'full stack', variants: ['fullstack', 'full-stack', 'end-to-end'] },
          { canonical: 'data', variants: ['big data', 'analytics', 'etl', 'data processing', 'data pipeline'] },
          { canonical: 'cloud', variants: ['aws', 'azure', 'gcp', 'google cloud', 'cloud computing'] },
          { canonical: 'mobile', variants: ['ios', 'android', 'react native', 'flutter', 'mobile app'] }
        ],
        management: [
          { canonical: 'manager', variants: ['team lead', 'team leader', 'lead', 'head of', 'supervisor', 'mgr', 'team manager', 'engineering manager', 'technical lead', 'tech lead', 'principal', 'staff', 'director', 'vp', 'cto', 'head'] },
          { canonical: 'senior', variants: ['sr', 'sr.', 'lead', 'principal', 'staff'] }
        ],
        skills: [
          { canonical: 'javascript', variants: ['js', 'node.js', 'nodejs', 'react', 'vue', 'angular'] },
          { canonical: 'python', variants: ['django', 'flask', 'fastapi', 'pandas', 'numpy'] },
          { canonical: 'java', variants: ['spring', 'spring boot', 'hibernate', 'maven', 'gradle'] },
          { canonical: 'database', variants: ['sql', 'mysql', 'postgresql', 'mongodb', 'redis', 'db'] }
        ]
      };

      // Create unified synonym map from both built-in and database synonyms
      const createUnifiedSynonymMap = () => {
        const synonymMap = new Map<string, Set<string>>();
        
        // Add built-in synonyms
        Object.values(builtInSynonyms).flat().forEach(group => {
          const allTerms = [group.canonical, ...group.variants];
          allTerms.forEach(term => {
            const normalized = term.toLowerCase();
            if (!synonymMap.has(normalized)) {
              synonymMap.set(normalized, new Set([normalized]));
            }
            allTerms.forEach(variant => {
              synonymMap.get(normalized)!.add(variant.toLowerCase());
            });
          });
        });

        // Add database synonyms
        synonyms?.forEach(s => {
          const canonical = s.canonical_term.toLowerCase();
          const variant = s.variant_term.toLowerCase();
          
          if (!synonymMap.has(canonical)) {
            synonymMap.set(canonical, new Set([canonical]));
          }
          if (!synonymMap.has(variant)) {
            synonymMap.set(variant, new Set([variant]));
          }
          
          synonymMap.get(canonical)!.add(variant);
          synonymMap.get(variant)!.add(canonical);
        });

        // Convert Sets to Arrays for easier processing
        const finalMap = new Map<string, string[]>();
        synonymMap.forEach((values, key) => {
          finalMap.set(key, Array.from(values));
        });
        
        return finalMap;
      };

      const unifiedSynonyms = createUnifiedSynonymMap();

      // Title normalization and component extraction
      const normalizeTitle = (title: string) => {
        return title.toLowerCase()
          .replace(/[^\w\s-]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      };

      const extractTitleComponents = (title: string) => {
        const normalized = normalizeTitle(title);
        const words = normalized.split(' ');
        
        // Extract seniority levels
        const seniorityLevels = ['junior', 'jr', 'mid', 'middle', 'senior', 'sr', 'lead', 'principal', 'staff', 'architect'];
        const seniority = words.find(word => seniorityLevels.some(level => level === word || word.startsWith(level)));
        
        // Extract domains
        const domains = ['backend', 'back-end', 'frontend', 'front-end', 'fullstack', 'full-stack', 'data', 'devops', 'mobile', 'cloud'];
        const domain = words.find(word => domains.some(d => word.includes(d) || d.includes(word)));
        
        // Extract roles
        const roles = ['engineer', 'developer', 'architect', 'analyst', 'scientist', 'manager'];
        const role = words.find(word => roles.some(r => word.includes(r) || r.includes(word)));
        
        return { seniority, domain, role, normalized };
      };

      // Enhanced term matching with word boundaries and synonym expansion
      const expandTermsWithSynonyms = (terms: string[]) => {
        const expandedTerms = new Set<string>();
        terms.forEach(term => {
          const lowerTerm = term.toLowerCase();
          expandedTerms.add(lowerTerm);
          const synonyms = unifiedSynonyms.get(lowerTerm) || [];
          synonyms.forEach(syn => expandedTerms.add(syn));
        });
        return Array.from(expandedTerms);
      };

      // Deterministic exclusion check with word boundaries
      const checkExclusionMatch = (text: string, excludeTerms: string[]) => {
        if (!excludeTerms || excludeTerms.length === 0) return { matched: false, reason: '' };
        
        const expandedExcludes = expandTermsWithSynonyms(excludeTerms);
        const lowerText = text.toLowerCase();
        
        for (const term of expandedExcludes) {
          // Use word boundary regex for precise matching
          const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          if (regex.test(lowerText)) {
            const originalTerm = excludeTerms.find(orig => 
              orig.toLowerCase() === term || (unifiedSynonyms.get(orig.toLowerCase()) || []).includes(term)
            );
            return { 
              matched: true, 
              reason: `Excluded by term: "${term}" (matches "${originalTerm}")` 
            };
          }
        }
        return { matched: false, reason: '' };
      };

      // Smart title matching with seniority consideration
      const checkTitleMatch = (candidateTitle: string, requiredTitles: string[], candidateProfile: string) => {
        if (!requiredTitles || requiredTitles.length === 0) return { matched: true, reason: 'No title requirements' };
        
        const candidateComponents = extractTitleComponents(candidateTitle);
        const profileText = `${candidateTitle} ${candidateProfile}`.toLowerCase();
        
        for (const reqTitle of requiredTitles) {
          const reqComponents = extractTitleComponents(reqTitle);
          let matches = 0;
          const reasons = [];
          
          // Check role match (engineer ≡ developer)
          if (reqComponents.role && candidateComponents.role) {
            const roleExpanded = unifiedSynonyms.get(reqComponents.role) || [reqComponents.role];
            const candidateRoleExpanded = unifiedSynonyms.get(candidateComponents.role) || [candidateComponents.role];
            
            if (roleExpanded.some(r => candidateRoleExpanded.includes(r))) {
              matches++;
              reasons.push(`Role match: ${candidateComponents.role} ≡ ${reqComponents.role}`);
            }
          }
          
          // Check domain match (backend, frontend, etc.)
          if (reqComponents.domain) {
            const domainExpanded = unifiedSynonyms.get(reqComponents.domain) || [reqComponents.domain];
            const foundInTitle = domainExpanded.some(d => candidateComponents.normalized.includes(d));
            const foundInProfile = domainExpanded.some(d => profileText.includes(d));
            
            if (foundInTitle || foundInProfile) {
              matches++;
              reasons.push(`Domain match: found ${reqComponents.domain} equivalent`);
            }
          }
          
          // Check seniority (senior+ should match lead/principal/staff)
          if (reqComponents.seniority) {
            const seniorityHierarchy = ['junior', 'jr', 'mid', 'middle', 'senior', 'sr', 'lead', 'principal', 'staff'];
            const reqIndex = seniorityHierarchy.findIndex(s => reqComponents.seniority?.includes(s));
            const candidateIndex = candidateComponents.seniority ? 
              seniorityHierarchy.findIndex(s => candidateComponents.seniority?.includes(s)) : -1;
            
            if (candidateIndex >= reqIndex) {
              matches++;
              reasons.push(`Seniority match: ${candidateComponents.seniority} >= ${reqComponents.seniority}`);
            }
          }
          
          // If we have at least 2 component matches or exact title match, consider it a match
          const exactMatch = expandTermsWithSynonyms([reqTitle]).some(term => 
            candidateComponents.normalized.includes(term) || profileText.includes(term)
          );
          
          if (matches >= 2 || exactMatch) {
            return { 
              matched: true, 
              reason: `Title matched: ${reasons.join('; ')}${exactMatch ? '; Exact match found' : ''}` 
            };
          }
        }
        
        return { matched: false, reason: 'No sufficient title component matches found' };
      };

      // Clear existing results for this job
      const { error: deleteError } = await supabase
        .from('filtered_results')
        .delete()
        .eq('user_id', user.id)
        .eq('job_id', filterRules.job_id);

      if (deleteError) {
        console.error('Error clearing previous results:', deleteError);
      }

      setCurrentStep('Processing candidates...');
      setProgress(30);

      let stage1Passed = 0;
      let stage2Passed = 0;
      let finalResults = 0;

      const results = [];

      console.log('Starting candidate processing...');

      // Process each candidate
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i];
        let stage1Pass = true;
        let stage2Pass = false;
        const filterReasons = [];

        // STAGE 1: Company & Lists Filtering - Check in specific order to get accurate reasons
        
        // Check blacklist first (current company only)
        const blacklist = blacklistCompanies?.map(b => b.company_name.toLowerCase()) || [];
        if (candidate.current_company && blacklist.includes(candidate.current_company.toLowerCase())) {
          stage1Pass = false;
          filterReasons.push('Blacklisted company');
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

        // Check Target companies (if enabled)
        if (stage1Pass && filterRules.use_target_companies_filter) {
          const targetList = targetCompanies?.map(c => c.company_name.toLowerCase()) || [];
          const currentCompany = candidate.current_company?.toLowerCase() || '';
          const previousCompany = candidate.previous_company?.toLowerCase() || '';
          
          const hasTargetCompany = targetList.some(company => 
            currentCompany.includes(company) || previousCompany.includes(company) ||
            company.includes(currentCompany) || company.includes(previousCompany)
          );
          
          if (!hasTargetCompany) {
            stage1Pass = false;
            filterReasons.push('Not in target companies');
          }
        }

        if (stage1Pass) stage1Passed++;

        // STAGE 2: Enhanced User Rules Filtering with Deterministic Pre-checks
        if (stage1Pass) {
          // Pre-check: Deterministic exclusion filtering (before AI)
          if (filterRules.exclude_terms && filterRules.exclude_terms.length > 0) {
            const profileText = `${candidate.current_title || ''} ${candidate.profile_summary || ''}`;
            const exclusionResult = checkExclusionMatch(profileText, filterRules.exclude_terms);
            if (exclusionResult.matched) {
              stage2Pass = false;
              filterReasons.push(exclusionResult.reason);
            }
          }

          // Pre-check: Enhanced title matching (before AI)
          if (stage2Pass && filterRules.required_titles && filterRules.required_titles.length > 0) {
            const titleResult = checkTitleMatch(
              candidate.current_title || '', 
              filterRules.required_titles, 
              candidate.profile_summary || ''
            );
            if (!titleResult.matched) {
              stage2Pass = false;
              filterReasons.push(`Title mismatch: ${titleResult.reason}`);
            } else {
              filterReasons.push(`Title matched: ${titleResult.reason}`);
            }
          }

          // Only proceed with AI analysis if deterministic checks passed
          if (stage2Pass) {
            try {
              // Prepare expanded terms for AI
              const expandedMustHave = filterRules.must_have_terms ? 
                expandTermsWithSynonyms(filterRules.must_have_terms) : [];
              const expandedExclude = filterRules.exclude_terms ? 
                expandTermsWithSynonyms(filterRules.exclude_terms) : [];
              const expandedTitles = filterRules.required_titles ? 
                expandTermsWithSynonyms(filterRules.required_titles) : [];

              // Call AI analysis function for semantic evaluation
              const { data: aiAnalysis, error: aiError } = await supabase.functions.invoke(
                'analyze-candidate-profile', 
                {
                  body: {
                    candidate,
                    filterRules: {
                      ...filterRules,
                      expanded_must_have_terms: expandedMustHave,
                      expanded_exclude_terms: expandedExclude,
                      expanded_required_titles: expandedTitles
                    },
                    userId: user.id,
                    synonyms: synonyms || []
                  }
                }
              );

              if (aiError) {
                console.error('AI Analysis error:', aiError);
                // Fallback to basic experience/duration checks only
                // (exclusion and title checks already done deterministically)
                
                // Enhanced experience check
                const experienceFromProfile = candidate.years_of_experience || 0;
                if (experienceFromProfile < filterRules.min_years_experience) {
                  stage2Pass = false;
                  filterReasons.push(`Insufficient experience: ${experienceFromProfile} years (required: ${filterRules.min_years_experience})`);
                }

                // Enhanced role duration check
                if (stage2Pass) {
                  const currentRoleDuration = candidate.months_in_current_role || 0;
                  if (currentRoleDuration < filterRules.min_months_current_role) {
                    stage2Pass = false;
                    filterReasons.push(`Insufficient role duration: ${currentRoleDuration} months (required: ${filterRules.min_months_current_role})`);
                  }
                }

                // Must-have terms check with synonyms (only if still passing)
                if (stage2Pass && filterRules.must_have_terms && filterRules.must_have_terms.length > 0) {
                  const profileText = `${candidate.current_title || ''} ${candidate.profile_summary || ''}`;
                  const expandedMustHave = expandTermsWithSynonyms(filterRules.must_have_terms);
                  const hasRequiredTerms = expandedMustHave.some(term => profileText.toLowerCase().includes(term));
                  
                  if (!hasRequiredTerms) {
                    stage2Pass = false;
                    filterReasons.push('Missing required terms (fallback check)');
                  }
                }

              } else if (aiAnalysis) {
                // Use AI analysis results, but override with deterministic results if conflicting
                console.log(`AI Analysis for ${candidate.full_name}:`, aiAnalysis);
                
                // Apply AI results for experience and duration only
                // (exclusion and title already checked deterministically)
                const aiPasses = (
                  aiAnalysis.passes_experience_check &&
                  aiAnalysis.passes_role_duration_check &&
                  aiAnalysis.passes_must_have_check
                );

                if (!aiPasses) {
                  stage2Pass = false;
                }

                // Add detailed AI-based reasons
                if (!aiAnalysis.passes_experience_check) {
                  filterReasons.push(`Insufficient experience: AI estimated ${aiAnalysis.estimated_years_experience || 'unknown'} years (required: ${filterRules.min_years_experience})`);
                }
                if (!aiAnalysis.passes_role_duration_check) {
                  filterReasons.push(`Insufficient role duration: AI estimated ${aiAnalysis.estimated_months_in_role || 'unknown'} months (required: ${filterRules.min_months_current_role})`);
                }
                if (!aiAnalysis.passes_must_have_check) {
                  filterReasons.push(`Low must-have terms match: AI score ${aiAnalysis.must_have_score || 0}% (required: 70%)`);
                }
              }
            } catch (aiCallError) {
              console.error('Failed to call AI analysis:', aiCallError);
              // Continue with basic checks as fallback
              const experienceFromProfile = candidate.years_of_experience || 0;
              if (experienceFromProfile < filterRules.min_years_experience) {
                stage2Pass = false;
                filterReasons.push(`Insufficient experience: ${experienceFromProfile} years (required: ${filterRules.min_years_experience})`);
              }
            }
          }


          // Check top university requirement (enhanced matching)
          if (stage2Pass && filterRules.require_top_uni) {
            const { data: topUniversities } = await supabase
              .from('top_universities')
              .select('university_name');

            const topUniList = topUniversities?.map(u => u.university_name.toLowerCase()) || [];
            const candidateEducation = candidate.education?.toLowerCase() || '';
            
            // Enhanced university matching with partial names, abbreviations, and word boundaries
            const checkUniversityMatch = (education: string, universityList: string[]) => {
              if (!education.trim()) return false;
              
              return universityList.some(uni => {
                // Direct substring match
                if (education.includes(uni) || uni.includes(education)) {
                  return true;
                }
                
                // Check key words from university name (handle abbreviations and partial names)
                const uniWords = uni.split(/[\s\-–—]+/).filter(w => w.length > 2 && !['of', 'the', 'for', 'and', 'in'].includes(w));
                const eduWords = education.split(/[\s\-–—,\.()]+/).filter(w => w.length > 2);
                
                // If we have significant word overlap (at least 2 key words or institution name match)
                const matches = uniWords.filter(uw => 
                  eduWords.some(ew => ew.includes(uw) || uw.includes(ew))
                );
                
                if (matches.length >= Math.min(2, uniWords.length)) {
                  return true;
                }
                
                // Handle common abbreviations and short names
                const commonAbbreviations = {
                  'mit': 'massachusetts institute of technology',
                  'caltech': 'california institute of technology',
                  'technion': 'israel institute of technology',
                  'tau': 'tel aviv university',
                  'huji': 'hebrew university',
                  'bgu': 'ben-gurion university',
                  'ubc': 'university of british columbia',
                  'mcgill': 'mcgill university',
                  'eth': 'eth zürich'
                };
                
                // Check if education contains known abbreviations
                for (const [abbrev, fullName] of Object.entries(commonAbbreviations)) {
                  if ((education.includes(abbrev) && uni.includes(fullName)) ||
                      (uni.includes(abbrev) && education.includes(fullName))) {
                    return true;
                  }
                }
                
                return false;
              });
            };
            
            const hasTopUni = checkUniversityMatch(candidateEducation, topUniList);
            if (!hasTopUni) {
              stage2Pass = false;
              filterReasons.push('Education not from recognized top university');
            } else {
              filterReasons.push('Top university requirement met');
            }
          }

          if (stage2Pass) stage2Passed++;
        }

        if (stage1Pass && stage2Pass) finalResults++;

        // Create result record
        results.push({
          user_id: user.id,
          job_id: filterRules.job_id,
          raw_data_id: candidate.id,
          stage_1_passed: stage1Pass,
          stage_2_passed: stage2Pass,
          filter_reasons: filterReasons
        });

        // Update progress every 100 candidates
        if (i % 100 === 0 || i === candidates.length - 1) {
          const progressPercent = 30 + ((i + 1) / candidates.length) * 60;
          setProgress(progressPercent);
          setStats(prev => ({
            ...prev,
            processed: i + 1,
            stage1Passed,
            stage2Passed,
            finalResults
          }));
          console.log(`Processed ${i + 1}/${candidates.length} candidates. Stage1: ${stage1Passed}, Stage2: ${stage2Passed}, Final: ${finalResults}`);
        }
      }

      // Save results to database
      console.log('Saving results to database...');
      setCurrentStep('Saving results...');
      setProgress(95);

      const { error } = await supabase
        .from('filtered_results')
        .insert(results);

      if (error) {
        console.error('Error saving results:', error);
        throw error;
      }

      setProgress(100);
      setCurrentStep('Completed!');
      setCompleted(true);

      console.log(`Filtering completed! Final stats: Stage1: ${stage1Passed}, Stage2: ${stage2Passed}, Final: ${finalResults}`);

      toast({
        title: "Filtering Complete!",
        description: `Processed ${candidates.length} candidates. ${finalResults} final results.`,
      });

    } catch (error: any) {
      console.error('Processing error:', error);
      toast({
        title: "Processing Error",
        description: error.message || "Failed to process filtering.",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Filter className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Scaler</h1>
          </div>
          <div className="flex items-center space-x-4">
            <Badge variant="secondary">
              {user.email}
            </Badge>
            <Link to="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Page Header */}
          <div className="text-center space-y-4">
            <div className="h-16 w-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto">
              <Play className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Process Filtering</h1>
            <p className="text-xl text-muted-foreground">
              Run the filtering algorithm on your candidate data
            </p>
          </div>

          {/* Stats Card */}
          <Card className="card-shadow">
            <CardHeader>
              <CardTitle>Processing Status</CardTitle>
              <CardDescription>
                Current progress of the filtering process
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-primary">{stats.totalCandidates}</div>
                  <p className="text-sm text-muted-foreground">Total Candidates</p>
                </div>
                <div className="text-center p-4 bg-muted/30 rounded-lg">
                  <div className="text-2xl font-bold text-secondary">{stats.processed}</div>
                  <p className="text-sm text-muted-foreground">Processed</p>
                </div>
              </div>

              {processing && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="w-full" />
                  </div>
                  <p className="text-sm text-muted-foreground text-center">
                    {currentStep}
                  </p>
                </div>
              )}

              {stats.processed > 0 && (
                <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <div className="text-lg font-bold text-secondary">{stats.stage1Passed}</div>
                    <p className="text-xs text-muted-foreground">Stage 1 Passed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-accent">{stats.stage2Passed}</div>
                    <p className="text-xs text-muted-foreground">Stage 2 Passed</p>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-primary">{stats.finalResults}</div>
                    <p className="text-xs text-muted-foreground">Final Results</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4">
            {!completed ? (
              <Button 
                variant="hero" 
                size="xl" 
                onClick={processFiltering}
                disabled={processing || stats.totalCandidates === 0}
                className="w-full"
              >
                {processing ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Play className="h-5 w-5" />
                    Start Filtering Process
                  </>
                )}
              </Button>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-center space-x-2 text-secondary">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">Filtering completed successfully!</span>
                </div>
                <Link to="/results">
                  <Button variant="hero" size="xl" className="w-full">
                    View Results
                  </Button>
                </Link>
              </div>
            )}

            {stats.totalCandidates === 0 && (
              <div className="text-center space-y-4 p-6 bg-muted/30 rounded-lg">
                <XCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="font-semibold mb-2">No Data to Process</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Please upload candidate data first before running the filtering process.
                  </p>
                  <Link to="/upload">
                    <Button variant="outline">
                      Upload Raw Data
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProcessFilter;