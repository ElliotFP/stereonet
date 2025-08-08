import type * as d3 from "d3";
import type { LineString, MultiLineString } from "geojson";

export interface PoleRepresentation {
  type: "Point";
  coordinates: [number, number];
}

// Either great-circle/arc as MultiLineString, or small-circle as LineString (future use)
export type PlaneDatum = MultiLineString | LineString;

export type PlanePath<D extends PlaneDatum = PlaneDatum> = d3.Selection<
  SVGPathElement,
  D,
  HTMLElement,
  undefined
>;

export type LinePath = d3.Selection<
  SVGPathElement,
  PoleRepresentation,
  HTMLElement,
  undefined
>;

export type PlaneData = {
  dipAngle: number;       // 0..90
  dipDirection: number;   // azimuth CW from north 0..360
  path: PlanePath | LinePath;
  color: string | null;
};

export type LineData = {
  dipAngle: number;
  dipDirection: number;
  path: LinePath;
  color: string | null;
};

// Cluster input data (what caller provides)
export type ClusterData = {
  cluster_planes: PlaneData[];     // members to render as poles
  centroid_plane?: PlaneData;      // optional; if absent, we compute it
  color: string | null;
};

export type StyleProperty = string | number | boolean;

export type StereonetStyle = Record<string, Record<string, StyleProperty>>;
