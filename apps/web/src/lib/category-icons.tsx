import {
  BookOpen,
  Calendar,
  CloudSun,
  Coins,
  GraduationCap,
  Landmark,
  MapPin,
  Microscope,
  Newspaper,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { CapabilityCategory } from '@/types/capability';

export const CATEGORY_ICONS: Record<CapabilityCategory, LucideIcon> = {
  academic: GraduationCap,
  news: Newspaper,
  crypto: Coins,
  finance: TrendingUp,
  weather: CloudSun,
  geography: MapPin,
  calendar: Calendar,
  knowledge: BookOpen,
  government: Landmark,
  research: Microscope,
};

export function categoryIcon(category: CapabilityCategory): LucideIcon {
  return CATEGORY_ICONS[category];
}
