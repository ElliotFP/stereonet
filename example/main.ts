import { Stereonet, type ClusterData, type PlaneData } from "../src";

const stereonet = new Stereonet({ selector: "body", size: 900 });

const mkPlane = (dip: number, dipDir: number): PlaneData => ({
  dipAngle: dip,
  dipDirection: dipDir,
  path: undefined as any,
  color: null,
});

// Cluster A (warm)
const clusterA: ClusterData = {
  name: "Cluster A",
  color: "#e41a1c",
  cluster_planes: [
    mkPlane(30, 110),
    mkPlane(32, 115),
    mkPlane(28, 105),
    mkPlane(35, 120),
    mkPlane(31, 112),
    mkPlane(33, 118),
    mkPlane(29, 108),
    mkPlane(34, 123),
    mkPlane(30, 114),
    mkPlane(32, 109),
  ],
};

// Cluster B (cool)
const clusterB: ClusterData = {
  name: "Cluster B",
  color: "#377eb8",
  cluster_planes: [
    mkPlane(60, 250),
    mkPlane(58, 245),
    mkPlane(62, 255),
    mkPlane(61, 248),
    mkPlane(59, 252),
    mkPlane(60, 258),
    mkPlane(63, 246),
    mkPlane(57, 249),
    mkPlane(61, 254),
    mkPlane(60, 243),
  ],
};

// Cluster C (green-ish)
const clusterC: ClusterData = {
  name: "Cluster C",
  color: "#4daf4a",
  cluster_planes: [
    mkPlane(45, 20),
    mkPlane(47, 18),
    mkPlane(43, 24),
    mkPlane(46, 15),
    mkPlane(44, 22),
    mkPlane(45, 26),
    mkPlane(42, 19),
    mkPlane(48, 17),
  ],
};

stereonet.addCluster(clusterA);
stereonet.addCluster(clusterB);
stereonet.addCluster(clusterC);

// Optional: sprinkle a few standalone poles for context
const extras: Array<[number, number]> = [
  [10, 300],
  [15, 40],
  [20, 200],
  [12, 130],
  [18, 320],
];
extras.forEach(([dip, dir]) => stereonet.addLine(dip, dir, "#777"));
