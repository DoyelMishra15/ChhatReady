import { z } from 'zod';

export const billInputSchema = z.object({
  discom: z.string().trim().max(120),
  consumerNumber: z.string().trim().max(40),
  billingPeriod: z.string().trim().max(60),
  tariffCategory: z.string().trim().max(60),
  unitsMonth: z.number().finite().min(1).max(20000),
  amountMonth: z.number().finite().min(1).max(10_000_000),
  sanctionedLoadKw: z.number().finite().min(0.1).max(500).nullable()
});

export const roofInputSchema = z.object({
  mode: z.enum(['map', 'manual']),
  polygon: z.array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)])).max(200),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  areaM2: z.number().finite().min(0).max(100000),
  obstructionPct: z.number().finite().min(0).max(40)
});

export const assumptionsPatchSchema = z
  .object({
    offsetTarget: z.number().min(0.3).max(1.2),
    avoidedRateFactor: z.number().min(0.3).max(1),
    areaPerKwM2: z.number().min(4).max(20),
    tariffEscalationPct: z.number().min(0).max(10),
    degradationPct: z.number().min(0).max(2),
    omPerKwPerYear: z.number().min(0).max(5000),
    inverterReplacementPerKw: z.number().min(0).max(30000),
    inverterReplacementYear: z.number().int().min(5).max(24),
    gridEmissionFactor: z.number().min(0.2).max(1.5),
    yieldFallbackPerKw: z.number().min(800).max(2200),
    annualUnitsOverride: z.number().min(100).max(200000).nullable(),
    grossCostOverride: z.number().min(10000).max(5_000_000).nullable()
  })
  .partial();

export const inputsUpdateSchema = z.object({
  bill: billInputSchema.optional(),
  roof: roofInputSchema.nullable().optional(),
  selectedKw: z.number().min(0.5).max(10).nullable().optional(),
  assumptions: assumptionsPatchSchema.optional()
});
export type InputsUpdate = z.infer<typeof inputsUpdateSchema>;

export const presignRequestSchema = z.object({
  caseId: z.string().min(8).max(40),
  kind: z.enum(['bill', 'quote']),
  contentType: z.enum(['image/png', 'image/jpeg', 'application/pdf']),
  fileSize: z.number().int().positive().optional()
});

export const extractRequestSchema = z.object({ key: z.string().min(5).max(300) });

export const emailRequestSchema = z.object({
  to: z.string().trim().toLowerCase().email().max(200)
});

export const rfqRequestSchema = z.object({
  recipients: z.array(z.string().trim().toLowerCase().email().max(200)).min(1).max(3),
  contactName: z.string().trim().min(1).max(60),
  contactEmail: z.string().trim().toLowerCase().email().max(200),
  contactPhone: z.string().trim().max(20).optional(),
  location: z.string().trim().max(100).optional(),
  note: z.string().trim().max(400).optional(),
  consent: z.literal(true)
});
export type RfqRequest = z.infer<typeof rfqRequestSchema>;

export const quoteCheckRequestSchema = z.object({ key: z.string().min(5).max(300) });

export const quoteEditSchema = z.object({
  totalPrice: z.number().finite().min(1000).max(50_000_000).nullable(),
  systemKw: z.number().finite().min(0.1).max(1000).nullable()
});

export const irradianceQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180)
});
