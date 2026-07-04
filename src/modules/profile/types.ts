export interface PassengerProfile {
  id: string;
  name: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  email: string;
  phone: string;
  emergencyContact?: {
    name: string;
    phone: string;
  };
  loyaltyNumber?: string;
  encrypted: boolean;
  createdAt: string;
}
