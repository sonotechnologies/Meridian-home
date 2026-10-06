import type { ListingType } from "./format";

/** The listing form's state, shared by the form (client) and its loader (server). */
export type FeeState = { mode: "amount" | "percent"; value: string };
export type FormState = {
  type: ListingType;
  propertyType: string;
  title: string;
  description: string;
  areaId: number | null;
  lng: number | null;
  lat: number | null;
  streetName: string;
  showStreet: boolean;
  bedrooms: number;
  bathrooms: number;
  toilets: number;
  parking: number;
  sizeSqm: string;
  furnished: boolean;
  serviced: boolean;
  amenities: string[];
  price: string;
  rent: { agencyFee: FeeState; legalFee: FeeState; cautionDeposit: FeeState; serviceCharge: FeeState };
  sale: { titleDocument: string; negotiable: boolean };
  shortlet: { minNights: string; cleaningFee: string; cautionDeposit: string };
  images: string[];
};

export const EMPTY_FORM: FormState = {
  type: "rent",
  propertyType: "apartment",
  title: "",
  description: "",
  areaId: null,
  lng: null,
  lat: null,
  streetName: "",
  showStreet: false,
  bedrooms: 2,
  bathrooms: 2,
  toilets: 3,
  parking: 1,
  sizeSqm: "",
  furnished: false,
  serviced: false,
  amenities: [],
  price: "",
  rent: {
    agencyFee: { mode: "percent", value: "10" },
    legalFee: { mode: "percent", value: "10" },
    cautionDeposit: { mode: "amount", value: "" },
    serviceCharge: { mode: "amount", value: "" },
  },
  sale: { titleDocument: "c-of-o", negotiable: false },
  shortlet: { minNights: "1", cleaningFee: "", cautionDeposit: "" },
  images: [],
};

export type AreaOpt = { id: number; name: string; lng: number; lat: number };

