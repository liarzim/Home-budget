import { BusinessMapping, Category, TransformedImportRow } from './types';

/**
 * Classifies a single merchant / payee string against an array of Business_Mapping rules.
 * Rules should be pre-sorted by priority descending.
 */
export function classifyPayee(
  payeeName: string,
  mappings: BusinessMapping[],
  categories: Category[]
): { categoryId: string | null; matchedRule?: string } {
  if (!payeeName || !payeeName.trim()) {
    return { categoryId: null };
  }

  const cleanPayee = payeeName.trim().toUpperCase();

  for (const rule of mappings) {
    const pattern = rule.pattern.trim().toUpperCase();
    if (!pattern) continue;

    let isMatch = false;

    if (rule.is_regex) {
      try {
        const regex = new RegExp(pattern, 'i');
        isMatch = regex.test(cleanPayee);
      } catch {
        isMatch = cleanPayee.includes(pattern);
      }
    } else {
      isMatch = cleanPayee.includes(pattern);
    }

    if (isMatch) {
      // Verify that category exists
      const targetCategory = categories.find((c) => c.id === rule.category_id);
      if (targetCategory) {
        return {
          categoryId: targetCategory.id,
          matchedRule: rule.pattern,
        };
      }
    }
  }

  return { categoryId: null };
}

/**
 * Re-evaluates all rows against mapping rules and updates categories accordingly.
 */
export function applyClassificationToRows(
  rows: TransformedImportRow[],
  mappings: BusinessMapping[],
  categories: Category[]
): TransformedImportRow[] {
  return rows.map((row) => {
    // If the user already manually picked a category, preserve it unless unassigned
    if (row.category_id && !row.auto_matched_rule) {
      return row;
    }

    const { categoryId, matchedRule } = classifyPayee(row.payee_name, mappings, categories);

    return {
      ...row,
      category_id: categoryId,
      auto_matched_rule: matchedRule,
      notes: matchedRule ? `Auto-mapped by rule: ${matchedRule}` : row.notes,
    };
  });
}
