import { ClusteringModels, Stereonet, type PlaneData, parseAllPlanesFromDFN } from "../src";

const stereonet = new Stereonet({ selector: "body", size: 900 });

const mkPlane = (dip: number, dipDir: number): PlaneData => ({
  
  dipAngle: dip,

  dipDirection: dipDir,
  path: undefined as any,
  color: null,
});

let allPlanes: PlaneData[] = [];

function rerender(model: string) {
  // clear
  stereonet.getClusters().forEach(({ id }) => stereonet.removeCluster(Number(id)));
  stereonet.getPlanes().forEach(({ id }) => stereonet.removePlane(Number(id)));
  stereonet.getLines().forEach(({ id }) => stereonet.removeLine(Number(id)));
  // stereonet.clearGlobalHeatmap();
  stereonet.setPlaneRepresentation("pole");

  if (model === "none") {
    allPlanes.forEach(p => stereonet.addPlane(p.dipAngle, p.dipDirection));
    return;
  }
  if (model === "dbscan") {
    const epsDeg = Number((document.getElementById("epsDeg") as HTMLInputElement)?.value) || 12;
    const minPts = Number((document.getElementById("minPts") as HTMLInputElement)?.value) || 8;
    const { clusters, outliers } = ClusteringModels.dbscanPlanes(allPlanes, { epsDeg, minPts });
    clusters.forEach(c => stereonet.addCluster(c));
    outliers.forEach(p => stereonet.addPlane(p.dipAngle, p.dipDirection, "#777"));
    return;
  }
  if (model === "optics") {
    const minPts = Number((document.getElementById("optMinPts") as HTMLInputElement)?.value) || 12;
    const quantile = Number((document.getElementById("optQuantile") as HTMLInputElement)?.value) || 0.75;
    const minClusterSize = Number((document.getElementById("optMinClusterSize") as HTMLInputElement)?.value) || 25;
    const { clusters, outliers } = ClusteringModels.opticsClusterPlanes(allPlanes, { minPts, quantile, minClusterSize });
    clusters.forEach(c => stereonet.addCluster(c));
    outliers.forEach(p => stereonet.addPlane(p.dipAngle, p.dipDirection, "#777"));
    return;
  }
}

const modelSelect = document.getElementById("model-select") as HTMLSelectElement;
const runBtn = document.getElementById("run-btn") as HTMLButtonElement | null;
if (modelSelect) {
  const onChange = () => {
    const v = modelSelect.value;
    (document.getElementById("params-dbscan") as HTMLSpanElement).style.display = v === "dbscan" ? "inline" : "none";
    (document.getElementById("params-optics") as HTMLSpanElement).style.display = v === "optics" ? "inline" : "none";
  };
  modelSelect.addEventListener("change", onChange);
  onChange();
}
if (runBtn) runBtn.addEventListener("click", () => rerender(modelSelect?.value ?? "none"));

// initial: load DFN dataset and render
(async () => {
  try {
    const url = new URL("../DFN_data/merged_blocks_with_fractures.json", import.meta.url).href;
    const dfn = await fetch(url).then(r => r.json());
    allPlanes = parseAllPlanesFromDFN(dfn);
  } catch {
    // fallback to a tiny demo set if fetch fails
    allPlanes = [mkPlane(30,110), mkPlane(45,220), mkPlane(60,300)];
  }
  rerender(modelSelect?.value ?? "none");
})();

// ---- Filter modal wiring ----
const filterBtn = document.getElementById("filter-btn") as HTMLButtonElement | null;
const modal = document.getElementById("filter-modal") as HTMLDivElement | null;
const applyBtn = document.getElementById("flt-apply") as HTMLButtonElement | null;
const cancelBtn = document.getElementById("flt-cancel") as HTMLButtonElement | null;
const resetBtn = document.getElementById("flt-reset") as HTMLButtonElement | null;

filterBtn?.addEventListener("click", () => { if (modal) modal.style.display = "flex"; });
cancelBtn?.addEventListener("click", () => { if (modal) modal.style.display = "none"; });
resetBtn?.addEventListener("click", () => {
  const setEmpty = (id: string) => {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = "";
  };
  setEmpty("flt-length-min");
  setEmpty("flt-length-max");
  setEmpty("flt-aperture-min");
  setEmpty("flt-aperture-max");
  setEmpty("flt-width-min");
  setEmpty("flt-width-max");
});

applyBtn?.addEventListener("click", async () => {
  const url = new URL("../DFN_data/merged_blocks_with_fractures.json", import.meta.url).href;
  const dfn = await fetch(url).then(r => r.json());
  const lengthMin = parseFloat((document.getElementById("flt-length-min") as HTMLInputElement | null)?.value ?? "");
  const lengthMax = parseFloat((document.getElementById("flt-length-max") as HTMLInputElement | null)?.value ?? "");
  const apertureMin = parseFloat((document.getElementById("flt-aperture-min") as HTMLInputElement | null)?.value ?? "");
  const apertureMax = parseFloat((document.getElementById("flt-aperture-max") as HTMLInputElement | null)?.value ?? "");
  const widthMin = parseFloat((document.getElementById("flt-width-min") as HTMLInputElement | null)?.value ?? "");
  const widthMax = parseFloat((document.getElementById("flt-width-max") as HTMLInputElement | null)?.value ?? "");

  allPlanes = parseAllPlanesFromDFN(dfn, {
    lengthMin: Number.isNaN(lengthMin) ? undefined : lengthMin,
    lengthMax: Number.isNaN(lengthMax) ? undefined : lengthMax,
    apertureMin: Number.isNaN(apertureMin) ? undefined : apertureMin,
    apertureMax: Number.isNaN(apertureMax) ? undefined : apertureMax,
    widthMin: Number.isNaN(widthMin) ? undefined : widthMin,
    widthMax: Number.isNaN(widthMax) ? undefined : widthMax,
  });
  if (modal) modal.style.display = "none";
  rerender(modelSelect?.value ?? "none");
});