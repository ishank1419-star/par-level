export type AppRole = "admin" | "employee";
export type ObsStatus = "Open" | "Close";
export type RiskLevel = "High" | "Medium" | "Low";

export type Profile = {
  id: string;
  full_name: string | null;
  role: AppRole;
};

export type Observation = {
  id: string;
  item_no: number;
  date: string; // YYYY-MM-DD
  contractor: string;
  location: string;
  category: string;
  risk: RiskLevel;
  observation: string | null;
  before_photo_url: string | null;
  after_photo_url: string | null;
  recommendation: string | null;
  assigned_to: string | null;
  status: ObsStatus;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
};
