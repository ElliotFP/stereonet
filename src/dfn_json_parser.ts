import type { PlaneData } from "./core";

// Convert lower-hemisphere normal vector to plane (dip, dipDirection) in degrees
function normalToPlaneDeg(nx: number, ny: number, nz: number) {
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) {
    return null as null;
  }
  // Flip to lower hemisphere (z >= 0)
  if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
  const plunge = Math.asin(Math.max(-1, Math.min(1, nz))); // radians
  const trend = Math.atan2(nx, ny); // radians, from north CW
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const norm360 = (a: number) => ((a % 360) + 360) % 360;
  const dip = 90 - toDeg(plunge);
  const dipDir = norm360(toDeg(trend) - 180);
  return { dipAngle: dip, dipDirection: dipDir };
}

/**
 * Parse all planes from the DFN JSON format in DFN_data/merged_blocks_with_fractures.json
 * Assumptions for this dataset:
 * - dfn.blocks[].fracture_data.orientations is an array of [nx, ny, nz] normals
 * - Optional arrays dfn.blocks[].fracture_data.lengths, apertures, widths align by index
 */
export function parseAllPlanesFromDFN(dfn: any): PlaneData[] {
  const planes: PlaneData[] = [];
  const blocks = (dfn?.blocks ?? []) as any[];
  for (const b of blocks) {
    const fd = b?.fracture_data ?? {};
    const orientations: any[] = Array.isArray(fd?.orientations) ? fd.orientations : [];
    const lengths: number[] = Array.isArray(fd?.lengths) ? fd.lengths : [];
    const apertures: number[] = Array.isArray(fd?.apertures) ? fd.apertures : [];
    const widths: number[] = Array.isArray((fd as any)?.widths) ? (fd as any).widths : [];

    for (let i = 0; i < orientations.length; i++) {
      const o = orientations[i];
      if (!Array.isArray(o) || o.length < 3) continue;
      const mapped = normalToPlaneDeg(Number(o[0]), Number(o[1]), Number(o[2]));
      if (!mapped) continue;
      planes.push({
        dipAngle: mapped.dipAngle,
        dipDirection: mapped.dipDirection,
        path: undefined as any,
        color: null,
      });
    }
  }
  return planes;
}


