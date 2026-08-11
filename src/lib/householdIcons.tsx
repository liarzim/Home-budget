import React from 'react';
import {
  Home,
  Building,
  Building2,
  Castle,
  Landmark,
  Store,
  Heart,
  Sparkles,
  Wallet,
  Briefcase,
  Coins,
  PiggyBank,
  Compass,
  Key,
  Shield,
  Sun,
  TreePine,
  Car,
  Plane,
  Warehouse,
  LucideIcon,
} from 'lucide-react';

export interface HouseholdIconOption {
  id: string;
  nameHe: string;
  nameEn: string;
  icon: LucideIcon;
}

export const HOUSEHOLD_ICONS: HouseholdIconOption[] = [
  { id: 'Home', nameHe: 'בית', nameEn: 'Home', icon: Home },
  { id: 'Building', nameHe: 'בניין', nameEn: 'Building', icon: Building },
  { id: 'Building2', nameHe: 'דירה', nameEn: 'Apartment', icon: Building2 },
  { id: 'Castle', nameHe: 'וילה / טירה', nameEn: 'Villa', icon: Castle },
  { id: 'Landmark', nameHe: 'נכס / מוסד', nameEn: 'Estate', icon: Landmark },
  { id: 'Store', nameHe: 'חנות / עסק', nameEn: 'Store', icon: Store },
  { id: 'Briefcase', nameHe: 'עסק / משרד', nameEn: 'Office', icon: Briefcase },
  { id: 'Heart', nameHe: 'משפחה', nameEn: 'Family', icon: Heart },
  { id: 'Sparkles', nameHe: 'פרימיום', nameEn: 'Premium', icon: Sparkles },
  { id: 'Wallet', nameHe: 'ארנק אישי', nameEn: 'Personal', icon: Wallet },
  { id: 'Coins', nameHe: 'השקעה', nameEn: 'Investment', icon: Coins },
  { id: 'PiggyBank', nameHe: 'חיסכון', nameEn: 'Savings', icon: PiggyBank },
  { id: 'Key', nameHe: 'שכירות', nameEn: 'Rental', icon: Key },
  { id: 'Sun', nameHe: 'נופש', nameEn: 'Vacation', icon: Sun },
  { id: 'Plane', nameHe: 'חו״ל', nameEn: 'Abroad', icon: Plane },
  { id: 'TreePine', nameHe: 'כפר / טבע', nameEn: 'Country', icon: TreePine },
  { id: 'Shield', nameHe: 'משותף', nameEn: 'Shared', icon: Shield },
  { id: 'Warehouse', nameHe: 'מחסן / נכס', nameEn: 'Property', icon: Warehouse },
  { id: 'Car', nameHe: 'רכב', nameEn: 'Vehicle', icon: Car },
  { id: 'Compass', nameHe: 'אחר', nameEn: 'Other', icon: Compass },
];

export const HOUSEHOLD_COLORS = [
  '#4F46E5', // Indigo
  '#0284C7', // Sky Blue
  '#10B981', // Emerald Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#06B6D4', // Cyan
  '#14B8A6', // Teal
  '#6366F1', // Violet
  '#64748B', // Slate
];

export const renderHouseholdIcon = (
  iconName?: string,
  size = 18,
  color?: string
): React.ReactNode => {
  const match = HOUSEHOLD_ICONS.find((item) => item.id.toLowerCase() === (iconName || '').toLowerCase());
  const IconComponent = match ? match.icon : Home;
  return <IconComponent size={size} color={color || 'currentColor'} />;
};
