import { describe, expect, it } from "vitest";
import { naira, nairaShort, normaliseNigerianPhone, priceUnit, relativeDays, slugify } from "../format";
import { distanceMetres, feeAmount, feeLabel, publicOffset, totalUpfront } from "../listing-rules";

describe("naira formatting", () => {
  it("uses the naira sign and thousands separators", () => {
    expect(naira(2_500_000)).toBe("₦2,500,000");
    expect(naira(65_000)).toBe("₦65,000");
  });

  it("uses the short form for pins", () => {
    expect(nairaShort(2_500_000)).toBe("₦2.5M");
    expect(nairaShort(4_500_000)).toBe("₦4.5M");
    expect(nairaShort(850_000)).toBe("₦850K");
    expect(nairaShort(65_000)).toBe("₦65K");
    expect(nairaShort(85_000_000)).toBe("₦85M");
    expect(nairaShort(120_000_000)).toBe("₦120M");
    expect(nairaShort(1_000_000)).toBe("₦1M");
    expect(nairaShort(10_450_000)).toBe("₦10.5M");
    expect(nairaShort(56_500_000)).toBe("₦56.5M");
    expect(nairaShort(1_200_000_000)).toBe("₦1.2B");
  });

  it("gives sale prices no unit", () => {
    expect(priceUnit("rent")).toBe("/ year");
    expect(priceUnit("shortlet")).toBe("/ night");
    expect(priceUnit("sale")).toBe("");
  });
});

describe("total upfront", () => {
  it("adds rent and every fee", () => {
    const rent = 4_500_000;
    const fees = {
      agencyFee: feeAmount({ mode: "percent", value: 10 }, rent),
      legalFee: feeAmount({ mode: "percent", value: 10 }, rent),
      cautionDeposit: feeAmount({ mode: "amount", value: 500_000 }, rent),
      serviceCharge: 450_000,
    };
    expect(fees.agencyFee).toBe(450_000);
    expect(totalUpfront(rent, fees)).toBe(6_350_000);
  });

  it("labels round percentages", () => {
    expect(feeLabel("agencyFee", "Agency fee", 450_000, 4_500_000)).toBe("Agency fee (10%)");
    expect(feeLabel("agencyFee", "Agency fee", 400_000, 4_500_000)).toBe("Agency fee");
    expect(feeLabel("cautionDeposit", "Caution deposit", 450_000, 4_500_000)).toBe("Caution deposit");
  });
});

describe("location privacy", () => {
  it("never moves the point more than 150 m", () => {
    const exact = { x: 3.4723, y: 6.4474 };
    for (let i = 0; i < 2000; i++) {
      const p = publicOffset(exact.x, exact.y);
      expect(distanceMetres(exact, p)).toBeLessThanOrEqual(150.5);
    }
  });

  it("moves it by the full radius at the edge", () => {
    const exact = { x: 3.4723, y: 6.4474 };
    const p = publicOffset(exact.x, exact.y, () => 0.999999);
    expect(distanceMetres(exact, p)).toBeGreaterThan(149);
  });
});

describe("phone numbers", () => {
  it("accepts local and international Nigerian forms", () => {
    expect(normaliseNigerianPhone("0803 412 7781")).toBe("+2348034127781");
    expect(normaliseNigerianPhone("+234 803 412 7781")).toBe("+2348034127781");
    expect(normaliseNigerianPhone("803 412 7781")).toBeNull();
    expect(normaliseNigerianPhone("12345")).toBeNull();
  });
});

describe("misc", () => {
  it("formats freshness", () => {
    const now = new Date("2026-10-06T12:00:00");
    expect(relativeDays(new Date("2026-10-06T08:00:00"), now)).toBe("today");
    expect(relativeDays(new Date("2026-10-05T20:00:00"), now)).toBe("yesterday");
    expect(relativeDays(new Date("2026-10-03T12:00:00"), now)).toBe("3 days ago");
    expect(relativeDays(new Date("2026-09-28T12:00:00"), now)).toBe("1 week ago");
  });

  it("slugifies titles", () => {
    expect(slugify("3 bedroom apartment with BQ, Lekki!")).toBe("3-bedroom-apartment-with-bq-lekki");
  });
});
