// Logic parser for handling AND/OR operations in filter terms

export interface LogicNode {
  type: 'AND' | 'OR' | 'TERM';
  value?: string;
  children?: LogicNode[];
}

export class LogicParser {
  /**
   * Parse a string with AND/OR logic into a tree structure
   * Supports: "node AND react", "typescript OR react", "(node AND react) OR python"
   * Default: comma-separated = OR (backward compatibility)
   */
  static parse(input: string): LogicNode {
    if (!input || !input.trim()) {
      return { type: 'OR', children: [] };
    }

    // Normalize input
    let normalized = input.trim()
      // Replace various AND operators
      .replace(/\s+(AND|&|and)\s+/gi, ' AND ')
      // Replace various OR operators  
      .replace(/\s+(OR|\||or)\s+/gi, ' OR ')
      // Handle commas as OR (backward compatibility)
      .replace(/\s*,\s*/g, ' OR ');

    // If no explicit operators found, treat as OR-separated terms
    if (!normalized.includes(' AND ') && !normalized.includes(' OR ')) {
      const terms = normalized.split(/\s+/).filter(Boolean);
      return {
        type: 'OR',
        children: terms.map(term => ({ type: 'TERM', value: term.trim() }))
      };
    }

    return this.parseExpression(normalized);
  }

  private static parseExpression(expr: string): LogicNode {
    // Handle parentheses first
    expr = expr.trim();
    
    if (expr.startsWith('(') && expr.endsWith(')')) {
      // Remove outer parentheses and parse inner expression
      return this.parseExpression(expr.slice(1, -1));
    }

    // Split by OR first (lower precedence)
    const orParts = this.splitByOperator(expr, 'OR');
    if (orParts.length > 1) {
      return {
        type: 'OR',
        children: orParts.map(part => this.parseExpression(part))
      };
    }

    // Split by AND (higher precedence)
    const andParts = this.splitByOperator(expr, 'AND');
    if (andParts.length > 1) {
      return {
        type: 'AND',
        children: andParts.map(part => this.parseExpression(part))
      };
    }

    // Single term
    return { type: 'TERM', value: expr.trim() };
  }

  private static splitByOperator(expr: string, operator: string): string[] {
    const parts: string[] = [];
    let current = '';
    let depth = 0;
    let i = 0;

    while (i < expr.length) {
      const char = expr[i];
      
      if (char === '(') {
        depth++;
        current += char;
      } else if (char === ')') {
        depth--;
        current += char;
      } else if (depth === 0 && expr.substr(i, operator.length + 2) === ` ${operator} `) {
        // Found operator at top level
        parts.push(current.trim());
        current = '';
        i += operator.length + 1; // Skip the operator and spaces
      } else {
        current += char;
      }
      i++;
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    return parts.length > 1 ? parts : [expr];
  }

  /**
   * Evaluate a logic tree against expanded terms
   */
  static evaluate(node: LogicNode, expandedTerms: string[], profileText: string): { 
    found: boolean; 
    matches: string[] 
  } {
    const matches: string[] = [];

    const evaluateNode = (n: LogicNode): boolean => {
      switch (n.type) {
        case 'TERM':
          if (!n.value) return false;
          
          // Find all expanded terms for this input term
          const termMatches = expandedTerms.filter(expandedTerm => 
            expandedTerm.includes(n.value!.toLowerCase()) || 
            n.value!.toLowerCase().includes(expandedTerm)
          );
          
          // Check if any of the expanded terms match in the profile
          for (const term of termMatches) {
            if (this.hasWordBoundaryMatch(profileText, term)) {
              matches.push(term);
              return true;
            }
          }
          return false;

        case 'AND':
          if (!n.children) return true;
          return n.children.every(child => evaluateNode(child));

        case 'OR':
          if (!n.children) return false;
          return n.children.some(child => evaluateNode(child));

        default:
          return false;
      }
    };

    const found = evaluateNode(node);
    return { found, matches: [...new Set(matches)] };
  }

  private static hasWordBoundaryMatch(text: string, term: string): boolean {
    if (!text || !term) return false;
    
    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  }
}

/**
 * Enhanced term expansion with logic support
 */
export const expandTermsWithLogic = (input: string, synonyms: any[]): {
  logicTree: LogicNode;
  allTerms: string[];
} => {
  if (!input || !input.trim()) {
    return { logicTree: { type: 'OR', children: [] }, allTerms: [] };
  }

  // Parse the logic tree
  const logicTree = LogicParser.parse(input);
  
  // Extract all unique terms from the tree
  const extractTerms = (node: LogicNode): string[] => {
    if (node.type === 'TERM' && node.value) {
      return [node.value.toLowerCase().trim()];
    }
    if (node.children) {
      return node.children.flatMap(child => extractTerms(child));
    }
    return [];
  };

  const baseTerms = extractTerms(logicTree);
  
  // Expand each term with synonyms
  const expandedTerms = new Set<string>();
  
  baseTerms.forEach(term => {
    expandedTerms.add(term);
    
    // Find synonyms for this term
    synonyms.forEach(synonym => {
      if (synonym.canonical_term.toLowerCase() === term) {
        expandedTerms.add(synonym.variant_term.toLowerCase().trim());
      }
      if (synonym.variant_term.toLowerCase() === term) {
        expandedTerms.add(synonym.canonical_term.toLowerCase().trim());
      }
    });
  });

  return {
    logicTree,
    allTerms: Array.from(expandedTerms)
  };
};

/**
 * Check if terms match profile using logic
 */
export const checkTermsWithLogic = (
  candidate: any, 
  input: string, 
  synonyms: any[]
): { found: boolean; matches: string[] } => {
  if (!input || !input.trim()) {
    return { found: false, matches: [] };
  }

  const { logicTree, allTerms } = expandTermsWithLogic(input, synonyms);
  
  const profileText = [
    candidate.current_title,
    candidate.profile_summary,
    candidate.education,
    candidate.degree,
    candidate.job_description,
    candidate.skills,
    candidate.previous_company,
    candidate.current_company,
    // Check additional skill fields from raw data (for backward compatibility)
    candidate.linkedinSkillsLabel,
    candidate.linkedinSkills,
    candidate.technologies,
    candidate.expertise,
    candidate.competencies
  ].filter(Boolean).join(' ').toLowerCase();

  return LogicParser.evaluate(logicTree, allTerms, profileText);
};