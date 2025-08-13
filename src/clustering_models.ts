// src/clustering_models.ts
// Basic clustering utilities over stereonet planes

import type { PlaneData, ClusterData } from "./core";

type Vec3 = { x: number; y: number; z: number };

export type DBSCANOptions = {
  epsDeg?: number; // neighborhood angle (deg) on the sphere
  minPts?: number; // minimum neighbors to form a core point
  palette?: string[];
  namePrefix?: string;
};

export type OPTICSOptions = {
  minPts?: number; // same definition as DBSCAN
  epsMaxDeg?: number; // cap neighborhood for ordering; Infinity by default
};

export type OPTICSResult = {
  order: number[];
  coreDistance: number[]; // radians; Infinity if undefined
  reachability: number[]; // radians; Infinity if undefined
};

export class ClusteringModels {
  // ------- math helpers -------
  private static toRad(d: number) { return (d * Math.PI) / 180; }
  private static toDeg(r: number) { return (r * 180) / Math.PI; }
  private static norm360(a: number) { return (a % 360 + 360) % 360; }

  // plane (dip, dipDir) → pole unit vector (lower hemisphere)
  private static planeToPoleVector(dip: number, dipDir: number): Vec3 {
    const trend = this.norm360(dipDir + 180);
    const plunge = 90 - dip;
    const T = this.toRad(trend);
    const P = this.toRad(plunge);
    const x = Math.cos(P) * Math.sin(T);
    const y = Math.cos(P) * Math.cos(T);
    const z = Math.sin(P);
    if (z < 0) return { x: -x, y: -y, z: -z };
    return { x, y, z };
  }

  private static meanPoleVectorsToPlane(vecs: Vec3[]) {
    const sx = vecs.reduce((s,v)=>s+v.x, 0);
    const sy = vecs.reduce((s,v)=>s+v.y, 0);
    const sz = vecs.reduce((s,v)=>s+v.z, 0);
    const len = Math.sqrt(sx*sx + sy*sy + sz*sz) || 1;
    let x = sx/len, y = sy/len, z = sz/len;
    if (z < 0) { x=-x; y=-y; z=-z; }
    const plunge = this.toDeg(Math.asin(z));
    const trend = this.norm360(this.toDeg(Math.atan2(x, y)));
    const dip = 90 - plunge;
    const dipDir = this.norm360(trend - 180);
    return { dipAngle: dip, dipDirection: dipDir };
  }

  private static angularDistance(a: Vec3, b: Vec3): number {
    const dot = Math.max(-1, Math.min(1, a.x*b.x + a.y*b.y + a.z*b.z));
    return Math.acos(dot); // radians
  }

  // ------- DBSCAN -------
  static dbscanPlanes(
    planes: PlaneData[],
    opts: DBSCANOptions = {}
  ): { clusters: ClusterData[]; outliers: PlaneData[] } {
    const epsRad = this.toRad(opts.epsDeg ?? 10);
    const minPts = opts.minPts ?? 4;

    const n = planes.length;
    if (n === 0) return { clusters: [], outliers: [] };

    const vecs = planes.map(p => this.planeToPoleVector(p.dipAngle, p.dipDirection));

    const neighbors = (i: number) => {
      const vi = vecs[i];
      const res: number[] = [];
      for (let j = 0; j < n; j++) {
        if (this.angularDistance(vi, vecs[j]) <= epsRad) res.push(j);
      }
      return res;
    };

    const visited = new Array<boolean>(n).fill(false);
    const label = new Array<number>(n).fill(-1); // -1 = unassigned, -2 = noise
    const clustersIdx: number[][] = [];

    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      visited[i] = true;
      const neigh = neighbors(i);
      if (neigh.length < minPts) { label[i] = -2; continue; }
      const cid = clustersIdx.length;
      clustersIdx.push([]);
      const queue = [...neigh];
      for (let qi = 0; qi < queue.length; qi++) {
        const q = queue[qi];
        if (!visited[q]) {
          visited[q] = true;
          const neigh2 = neighbors(q);
          if (neigh2.length >= minPts) {
            for (const k of neigh2) if (!queue.includes(k)) queue.push(k);
          }
        }
        if (label[q] === -1 || label[q] === -2) {
          label[q] = cid;
          clustersIdx[cid].push(q);
        }
      }
    }

    const palette =
      opts.palette ?? ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"];

    const clusters: ClusterData[] = clustersIdx.map((idxs, ci) => {
      const color = palette[ci % palette.length];
      const cluster_planes = idxs.map(i => planes[i]);
      const mean = this.meanPoleVectorsToPlane(idxs.map(i => vecs[i]));
      const centroid_plane = {
        dipAngle: mean.dipAngle,
        dipDirection: mean.dipDirection,
        path: undefined as any,
        color,
      };
      return { cluster_planes, centroid_plane, color, name: `${opts.namePrefix ?? "Cluster"} ${ci+1}` };
    });

    const outliers = planes.filter((_, i) => label[i] < 0);
    return { clusters, outliers };
  }

  // ------- OPTICS (ordering + simple extraction) -------
  static opticsOrder(planes: PlaneData[], opts: OPTICSOptions = {}): OPTICSResult {
    const n = planes.length;
    const minPts = opts.minPts ?? 10;
    const epsMax = (opts.epsMaxDeg ?? Infinity) * Math.PI / 180;
    const vecs = planes.map(p => this.planeToPoleVector(p.dipAngle, p.dipDirection));

    const UNPROC = 0, PROC = 1;
    const state = new Array<number>(n).fill(UNPROC);
    const reachability = new Array<number>(n).fill(Infinity);
    const coreDist = new Array<number>(n).fill(Infinity);
    const order: number[] = [];

    const getDistances = (i: number) => {
      const dists: number[] = new Array(n);
      for (let j = 0; j < n; j++) dists[j] = this.angularDistance(vecs[i], vecs[j]);
      return dists;
    };

    const update = (p: number, neighbors: number[], dists: number[]) => {
      const k = minPts;
      const within = neighbors.map(j => dists[j]).sort((a,b)=>a-b);
      const cd = within.length >= k ? within[k-1] : Infinity;
      coreDist[p] = cd;
      if (!isFinite(cd)) return;
      for (const o of neighbors) {
        if (state[o] === UNPROC) {
          const newReach = Math.max(cd, dists[o]);
          if (newReach < reachability[o]) reachability[o] = newReach;
        }
      }
    };

    for (let i = 0; i < n; i++) {
      if (state[i] !== UNPROC) continue;
      const d0 = getDistances(i);
      const neigh0: number[] = [];
      for (let j = 0; j < n; j++) if (d0[j] <= epsMax) neigh0.push(j);
      state[i] = PROC; order.push(i); update(i, neigh0, d0);

      while (true) {
        let best = -1, bestVal = Infinity;
        for (let j = 0; j < n; j++) if (state[j] === UNPROC && reachability[j] < bestVal) { best=j; bestVal=reachability[j]; }
        if (best < 0) break;
        const d = getDistances(best);
        const neigh: number[] = [];
        for (let j = 0; j < n; j++) if (d[j] <= epsMax) neigh.push(j);
        state[best] = PROC; order.push(best); update(best, neigh, d);
      }
    }

    return { order, coreDistance: coreDist, reachability };
  }

  static extractClustersFromOPTICS(
    optics: OPTICSResult,
    opts: { minClusterSize?: number; quantile?: number } = {}
  ): { clusters: number[][]; outliers: number[] } {
    const order = optics.order;
    const reach = optics.reachability;
    const n = order.length;
    const q = opts.quantile ?? 0.75;
    const minSize = opts.minClusterSize ?? 10;

    const finiteVals = reach.filter(v => isFinite(v));
    const sorted = [...finiteVals].sort((a,b)=>a-b);
    const t = sorted.length ? sorted[Math.floor(sorted.length * q)] : Infinity;

    const clusters: number[][] = [];
    const outliers: number[] = [];
    let current: number[] = [];
    for (let k = 0; k < n; k++) {
      const idx = order[k];
      const r = reach[idx];
      if (r <= t) {
        current.push(idx);
      } else {
        if (current.length >= minSize) clusters.push(current);
        else outliers.push(...current);
        current = [];
        outliers.push(idx);
      }
    }
    if (current.length >= minSize) clusters.push(current);
    else outliers.push(...current);

    return { clusters, outliers };
  }

  // Convenience: full pipeline returning ClusterData/outliers for OPTICS
  static opticsClusterPlanes(
    planes: PlaneData[],
    opts: OPTICSOptions & { quantile?: number; minClusterSize?: number; palette?: string[]; namePrefix?: string } = {}
  ): { clusters: ClusterData[]; outliers: PlaneData[] } {
    const optics = this.opticsOrder(planes, opts);
    const extracted = this.extractClustersFromOPTICS(optics, { quantile: opts.quantile, minClusterSize: opts.minClusterSize });

    const palette =
      opts.palette ?? ["#e41a1c", "#377eb8", "#4daf4a", "#984ea3", "#ff7f00", "#a65628", "#f781bf", "#999999"];

    const vecs = planes.map(p => this.planeToPoleVector(p.dipAngle, p.dipDirection));

    const clusters: ClusterData[] = extracted.clusters.map((idxs, ci) => {
      const color = palette[ci % palette.length];
      const cluster_planes = idxs.map(i => planes[i]);
      const mean = this.meanPoleVectorsToPlane(idxs.map(i => vecs[i]));
      const centroid_plane = {
        dipAngle: mean.dipAngle,
        dipDirection: mean.dipDirection,
        path: undefined as any,
        color,
      };
      return { cluster_planes, centroid_plane, color, name: `${opts.namePrefix ?? "Cluster"} ${ci+1}` };
    });

    const outliers = extracted.outliers.map(i => planes[i]);
    return { clusters, outliers };
  }
}


