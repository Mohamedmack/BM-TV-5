import { LucideIcon } from "lucide-react";

export interface User {
  id: number;
  prenom?: string;
  nom?: string;
  telephone: string;
  role: 'user' | 'admin' | 'owner';
  statut: 'active' | 'suspended' | 'banned';
  permissions?: string[];
  last_profile_update?: string;
  last_tutorial_watch?: string;
}

export interface Series {
  id: number;
  titre: string;
  description: string;
  image: string;
  banniere: string;
  genre?: string;
  langue?: string;
  saisons?: Season[];
}

export interface Season {
  id: number;
  id_serie: number;
  numero: number;
  prix: number;
  titre?: string;
  statut?: 'published' | 'draft' | 'reserved';
  date_publication?: string;
}

export interface Episode {
  id: number;
  id_saison: number;
  titre: string;
  url_video: string;
  statut: 'locked' | 'unlocked' | 'draft' | 'reserved';
  accessible?: boolean;
}

export interface PaymentRequest {
  id: number;
  id_utilisateur: number;
  telephone_utilisateur?: string;
  nom_utilisateur?: string;
  telephone: string;
  titre_serie: string;
  numero_saison: number;
  id_saison: number;
  prix: number;
  numero_paiement?: string;
  solde_apres_paiement?: string;
  date: string;
  statut: 'pending' | 'approved' | 'rejected' | 'revoked';
}

export interface Stat {
  id_saison: number;
  titre_serie: string;
  numero_saison: number;
  prix_saison: number;
  compte: number;
  total_recettes: number;
}

export interface PinResetRequest {
  id: number;
  id_utilisateur: number;
  telephone_utilisateur: string;
  nom_utilisateur: string;
  date: string;
  statut: 'pending' | 'approved' | 'completed';
}
