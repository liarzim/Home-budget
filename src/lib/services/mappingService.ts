import { supabase, isSupabaseConfigured } from '../supabase';
import { BusinessMapping } from '../types';
import { mockBusinessMappings } from '../mockData';

/**
 * Fetches all Business_Mapping rules for the given household from Supabase.
 * Rules are sorted by priority in descending order.
 */
export async function fetchHouseholdMappings(
  householdId: string,
  isDemoMode: boolean = false
): Promise<BusinessMapping[]> {
  if (isDemoMode || !isSupabaseConfigured) {
    return mockBusinessMappings.filter((m) => m.household_id === householdId || m.household_id === 'hh-main');
  }

  try {
    const { data, error } = await supabase
      .from('business_mapping')
      .select('*')
      .eq('household_id', householdId)
      .order('priority', { ascending: false });

    if (error) {
      console.error('Error fetching mappings from Supabase:', error.message);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error('Network exception fetching mappings:', err);
    return [];
  }
}

/**
 * Creates and persists a new Business_Mapping rule to Supabase.
 */
export async function saveBusinessMapping(
  householdId: string,
  pattern: string,
  categoryId: string,
  priority: number = 10,
  isDemoMode: boolean = false
): Promise<BusinessMapping> {
  const cleanPattern = pattern.trim().toUpperCase();

  const newRule: BusinessMapping = {
    id: `bm-${Date.now()}`,
    household_id: householdId,
    pattern: cleanPattern,
    category_id: categoryId,
    priority,
    is_regex: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (isDemoMode || !isSupabaseConfigured) {
    return newRule;
  }

  try {
    const { data, error } = await supabase
      .from('business_mapping')
      .insert({
        household_id: householdId,
        pattern: cleanPattern,
        category_id: categoryId,
        priority,
        is_regex: false,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to save mapping rule: ${error.message}`);
    }

    return data;
  } catch (err: any) {
    console.error('Error saving mapping to Supabase:', err);
    throw err;
  }
}
