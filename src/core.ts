import * as d3 from "d3";
import "./style.css";

import {
  PlanePath,
  LinePath,
  PoleRepresentation,
  PlaneData,
  StereonetStyle,
  LineData,
} from "./types";

const DEFAULT_STYLE: StereonetStyle = {
  stereonet_outline: {
    fill: "none",
    stroke: "#000",
    "stroke-width": "4px",
    "stroke-opacity": 0.5,
  },
  graticule: {
    fill: "none",
    stroke: " #777",
    "stroke-width": ".5px",
    "stroke-opacity": 0.5,
  },
  graticule_10_deg: {
    stroke: "#000",
    "stroke-width": 0.6,
    fill: "none",
  },
  crosshairs: {
    stroke: "#000",
    "stroke-width": 1,
    fill: "none",
  },
  data_plane: {
    stroke: "#d14747",
    "stroke-width": 3,
    fill: "none",
  },
  data_plane_pole: {
    fill: "#d14747",
    stroke: "#d14747",
    "stroke-width": 2,
    "stroke-opacity": 0.5,
    "fill-opacity": 1,
  },
  data_line: {
    fill: "#0328fc",
    stroke: "#0328fc",
    "stroke-width": 2,
    "stroke-opacity": 0.5,
    "fill-opacity": 1,
  },
  cardinal: {
    fill: "#000",
    "font-size": "12px",
    "text-anchor": "middle",
  },
};

interface StereonetOptions {
  selector?: string;
  element?: HTMLElement;
  size?: number;
  style?: Partial<StereonetStyle>;
  animations?:
    | {
        duration: number;
      }
    | false;
  showGraticules?: boolean;
  planeRepresentation?: "pole" | "arc";
  pointSize?: number; 
}

export class Stereonet {
  width: number;
  height: number;
  container: HTMLElement;
  svg: d3.Selection<SVGSVGElement, unknown, HTMLElement, undefined>;
  g: d3.Selection<SVGGElement, unknown, HTMLElement, undefined>;
  projection: d3.GeoProjection;
  path: d3.GeoPath;
  cardinalValues: string[];
  styles: StereonetStyle;
  animations:
    | {
        duration: number;
      }
    | false;
  planes: Map<string, PlaneData>;
  lines: Map<string, LineData>;
  graticulesVisible: boolean;
  planeRepresentation: "pole" | "arc"; // Representation of the planes on the stereonet
  pointSize: number; // Size of the points representing poles

  constructor({
    selector = "body",
    element,
    style = DEFAULT_STYLE,
    animations = {
      duration: 300,
    },
    showGraticules = true,
    pointSize = 5,
    planeRepresentation: planeRepresentation = "arc",
  }: StereonetOptions) {
    if (!selector && !element) {
      throw new Error(
        "Either 'selector' or 'element' must be provided to initialize Stereonet."
      );
    }

    const container =
      element || (document.querySelector(selector) as HTMLElement);

    const rect = container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.width; // Maintain 1:1 aspect ratio
    this.container = container;
    // @ts-expect-error no-issue
    this.styles = {
      ...DEFAULT_STYLE,
      ...style,
    };
    this.animations = animations;
    this.graticulesVisible = showGraticules;
    this.planeRepresentation = planeRepresentation;
    this.pointSize = pointSize;

    // @ts-expect-error no-issue
    this.svg = d3
      .select<HTMLElement, unknown>(this.container || selector)
      .append("svg")
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");

    this.g = this.svg.append("g");

    this.projection = d3
      .geoAzimuthalEqualArea()
      .scale(this.width / Math.PI)
      .translate([0, 0])
      .precision(0.1);

    this.path = d3.geoPath().projection(this.projection);

    this.cardinalValues = ["S", "W", "N", "E"];
    this.planes = new Map();
    this.lines = new Map();

    if (this.graticulesVisible) {
      this._renderBaseGraticules();
    }
    this._renderOutlineCrosshairs();

    window.addEventListener("resize", () => this._resize());
  }

  private _resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = rect.width;
    this.height = rect.width; // Maintain square aspect ratio

    this.svg
      .attr("viewBox", `0 0 ${this.width} ${this.height}`)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .style("width", "100%")
      .style("height", "auto");

    this.projection.scale(this.width / Math.PI).translate([0, 0]);

    this.path = d3.geoPath().projection(this.projection);

    // Remove and re-render all content
    this.g.selectAll("*").remove();

    if (this.graticulesVisible) {
      this._renderBaseGraticules();
    }
    this._renderOutlineCrosshairs();

    const currentPlanes = Array.from(this.planes.entries());
    const currentLines = Array.from(this.lines.entries());
    this.planes.clear();
    this.lines.clear();

    for (const [, plane] of currentPlanes) {
      this.addPlane(plane.dipAngle, plane.dipDirection, plane.color);
    }
    for (const [, line] of currentLines) {
      this.addLine(line.dipAngle, line.dipDirection, line.color);
    }
  }

  setPlaneRepresentation(representation: "pole" | "arc") {
    if (representation !== "pole" && representation !== "arc") {
      throw new Error(
        `Invalid representation type: ${representation}. Use "pole" or "arc".`
      );
    }
    this.planeRepresentation = representation;

    // Clear existing planes
    const _cachedPlanes = Array.from(this.planes);
    this.planes.forEach((_plane, id) => {
      this.planes.get(id)?.path.remove();
      this.planes.delete(id);
    });

    // Re-render existing planes with the new representation
    _cachedPlanes.forEach(([id, planeData]) => {
      let path = null;
      if (this.planeRepresentation === "arc") {
        path = this._renderPlaneAsArc(
          planeData.dipAngle,
          planeData.dipDirection,
          parseInt(id, 10),
          planeData.color
        );
      }
      if (this.planeRepresentation === "pole") {
        path = this._renderPlaneAsPole(
          planeData.dipAngle,
          planeData.dipDirection,
          parseInt(id, 10),
          planeData.color
        );
      }

      this.planes.set(id, {
        dipAngle: planeData.dipAngle,
        dipDirection: planeData.dipDirection,
        path: path as PlanePath,
        color: planeData.color,
      });
    });
  }

  /**
   * Returns the style for a given class name from this.styles object.
   * It returns a string representation of the style object.
   */
  getStyle(className: string) {
    const style = this.styles[className];
    if (!style) {
      throw new Error(`Style for class "${className}" not found.`);
    }
    return Object.entries(style)
      .map(([key, value]) => `${key}: ${value};`)
      .join(" ");
  }

  setStyle(className: string, style: Record<string, never>) {
    this.styles[className] = style;
  }

  private _elementTransformString() {
    return `translate(${this.width / 2},${this.height / 2})`;
  }

  private _renderBaseGraticules() {
    const graticule2 = d3
      .geoGraticule()
      .extent([
        [-90, -90],
        [90.1, 90],
      ])
      .step([2, 2])
      .precision(1);

    const graticule10 = d3
      .geoGraticule()
      .extent([
        [-90, -90],
        [90.1, 90],
      ])
      .step([10, 10])
      .precision(1);

    this.g
      .append("path")
      .datum(graticule2)
      .attr("class", "graticule")
      .attr("style", this.getStyle("graticule"))
      .attr("transform", `${this._elementTransformString()} `)
      .attr("d", this.path);

    this.g
      .append("path")
      .datum(graticule10)
      .attr("class", "graticule-10")
      .attr("style", this.getStyle("graticule_10_deg"))
      .attr("transform", `${this._elementTransformString()} `)
      .attr("d", this.path);

    const outline = d3.geoCircle().center([0, 0]).radius(90);
    this.g
      .append("path")
      .datum(outline)
      .attr("class", "stereonet-outline")
      .attr("style", this.getStyle("stereonet_outline"))
      .attr("transform", `${this._elementTransformString()} `)
      .attr("d", this.path);
  }

  private _renderOutlineCrosshairs() {
    // Add a 10x10 degree crosshair in the center
    const crosshairs = d3
      .geoGraticule()
      .extent([
        // lon, lat
        [-5.49, -5.49], //min
        [5.49, 5.49], //max
      ])
      .step([10, 10])
      .precision(1);

    this.g
      .append("path")
      .datum(crosshairs)
      .attr("style", this.getStyle("crosshairs"))
      .attr("transform", `${this._elementTransformString()} `)
      .attr("d", this.path);

    // Add outline circle
    const outline = d3.geoCircle().center([0, 0]).radius(90);
    this.g
      .append("path")
      .datum(outline)
      .attr("style", this.getStyle("stereonet_outline"))
      .attr("transform", `${this._elementTransformString()} `)
      .attr("d", this.path);
  }

  toggleGraticules(v: boolean | undefined) {
    const show = v === undefined ? !this.graticulesVisible : v;
    this.graticulesVisible = show;
    this.g
      .selectAll(".graticule, .graticule-10, .stereonet-outline")
      .style("display", show ? "block" : "none");
  }

  showGraticules() {
    this.toggleGraticules(true);
  }

  hideGraticules() {
    this.toggleGraticules(false);
  }

  private _validateDipDirection(dipAngle: number, dipDirection: number) {
    if (dipAngle < 0 || dipAngle > 90) {
      console.warn(
        `Dip angle must be between 0 and 90 degrees (${dipAngle} provided). Skipping.`
      );
      return false;
    }

    if (dipDirection < 0 || dipDirection > 360) {
      console.warn(
        `Dip direction must be between 0 and 360 degrees (${dipDirection} provided). Skipping.`
      );
      return false;
    }

    return true;
  }

  // Add this helper method to the Stereonet class
  private _createCustomColorStyle(color: string, elementType: "line" | "plane" | "plane_pole"): string {
    const baseStyle = elementType === "line" 
      ? { ...this.styles.data_line }
      : elementType === "plane"
      ? { ...this.styles.data_plane }
      : { ...this.styles.data_plane_pole };

    // Override color properties
    if (elementType === "plane") {
      // no fill for planes
      baseStyle.stroke = color;
    }
    else {
      baseStyle.fill = color;
      baseStyle.stroke = color;
    }

    // Convert to CSS string
    return Object.entries(baseStyle)
      .map(([key, value]) => `${key}: ${value};`)
      .join(" ");
  }

  private _addPlaneHoverInteraction(
    path: PlanePath,
    dipAngle: number,
    dipDirection: number,
  ) {
    // Add tooltip element if it doesn't exist
    if (!d3.select("#plane-tooltip").node()) {
      d3.select("body")
        .append("div")
        .attr("id", "plane-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.7)")
        .style("color", "#fff")
        .style("padding", "4px 8px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "18px")
        .style("display", "none");
    }

    // const originalStrokeWidth = path.style("stroke-width") || String(this.styles.data_plane["stroke-width"]);
    const tooltip = d3.select("#plane-tooltip");

    const getStyle = (className: string) => {
      const style = this.styles[className];
      if (!style) {
        throw new Error(`Style for class "${className}" not found.`);
      }
      return style;
    };

    let originalStrokeWidth = this.styles.data_plane["stroke-width"];
    path
      .on("mouseover", function () {
        const sel = d3.select(this as SVGPathElement);
        originalStrokeWidth = sel.style("stroke-width") || originalStrokeWidth;
        sel.style("stroke-width", "10px");
        sel.style("opacity", 0.6);
        tooltip.html(`Dip: ${dipAngle}°, Dip Direction: ${dipDirection}°`).style("display", "block");
      })
      .on("mousemove", function (event) {
        tooltip.style("left", event.pageX + 10 + "px").style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", function () {
        const sel = d3.select(this as SVGPathElement);
        sel.style("stroke-width", originalStrokeWidth);
        sel.style("opacity", 1);
        tooltip.style("display", "none");
      });
  }

  private _calculatePoleCoordinates(
    dipAngle: number, // placement on the dip direction line [0, 90]
    dipDirection: number // clockwise from north [0, 360)
  ): [number, number] {
    let dd = dipDirection + 180;

    if (dd >= 360) {
      dd = dipDirection + 180 - 360; // Normalize to [0, 360)
    }

    const d = 90 - dipAngle;
    return [d, dd];
  }

  private _renderPlaneAsArc(
    dipAngle: number,
    dipDirection: number,
    id: number,
    color?: string | null
  ) {
    const extentStart = 90 - dipAngle;
    const extentEnd = 90 - (dipAngle - 1);

    const graticuleInput = d3
      .geoGraticule()
      .extent([
        [extentStart, -90],
        [extentEnd, 90],
      ])
      // @ts-expect-error no-issue
      .step([1])
      .precision(1);

    const path = this.g
      .append("path")
      .datum(graticuleInput)
      .attr("style", color ? this._createCustomColorStyle(color, "plane") : this.getStyle("data_plane"))
      .attr(
        "transform",
        `${this._elementTransformString()} rotate(${dipDirection - 90})`
      )
      .attr("d", this.path)
      .attr("data-id", id);

    if (this.animations) {
      path
        .style("opacity", 0)
        .transition()
        .duration(this.animations.duration)
        .style("opacity", 1);
    }

    this._addPlaneHoverInteraction(path, dipAngle, dipDirection);


    return path;
  }

  private _renderPlaneAsPole(
    dipAngle: number,
    dipDirection: number,
    id: number,
    color?: string | null
  ) {
    const poleCoords = this._calculatePoleCoordinates(dipAngle, dipDirection);
    const point = {
      type: "Point",
      coordinates: [0, 90 - poleCoords[0]],
    } as PoleRepresentation;

    const path = this.g
      .append("path")
      .datum(point)
      .attr("style", color ? this._createCustomColorStyle(color, "plane_pole") : this.getStyle("data_plane_pole"))
      .attr(
        "transform",
        `${this._elementTransformString()} rotate(${poleCoords[1]})`
      )
      .attr("data-id", id);

    if (this.animations) {
      path
        .attr("d", this.path.pointRadius(0))
        .style("opacity", 0)
        .transition()
        .duration(this.animations.duration)
        .attr("d", this.path.pointRadius(this.pointSize))
        .style("opacity", 1);
    } else {
      path.attr("d", this.path.pointRadius(this.pointSize));
    }

    // @ts-expect-error no-issuer
    this._addPlaneHoverInteraction(path, dipAngle, dipDirection);

    return path;
  }

  /**
   * Plots a plane on the stereonet based on the given dip angle and dip direction.
   */
  addPlane(dipAngle: number, dipDirection: number, color?: string | null) {
    // Validate the dip angle and dip direction
    if (!this._validateDipDirection(dipAngle, dipDirection)) {
      return;
    }

    const id = this.planes.size;
    let path = null;

    if (this.planeRepresentation === "arc") {
      path = this._renderPlaneAsArc(dipAngle, dipDirection, id, color);
    }

    if (this.planeRepresentation === "pole") {
      path = this._renderPlaneAsPole(dipAngle, dipDirection, id, color);
    }

    this.planes.set(id.toString(), {
      dipAngle,
      dipDirection,
      path: path as PlanePath,
      color: color || null,
    });

    return id;
  }

  removePlane(planeId: number) {
    const strId = planeId.toString();

    if (this.planes.has(strId)) {
      this.planes.get(strId)?.path.remove();
      this.planes.delete(strId);
    }
  }

  getPlanes() {
    return Array.from(this.planes).map(line => {
      return { id: line[0], path: line[1] };
    });
  }

  private _addLineHoverInteraction(
    path: LinePath,
    dipAngle: number,
    dipDirection: number,
  ) {
    if (!d3.select("#line-tooltip").node()) {
      d3.select("body")
        .append("div")
        .attr("id", "line-tooltip")
        .style("position", "absolute")
        .style("background", "rgba(0,0,0,0.7)")
        .style("color", "#fff")
        .style("padding", "4px 8px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("font-size", "18px")
        .style("display", "none");
    }

    const tooltip = d3.select("#line-tooltip");
    const classPath = this.path;

    const normalPointSize = this.pointSize;
    const largePointSize = this.pointSize * 1.5;

    const originalStrokeWidth = this.styles.data_line["stroke-width"];
    
    path
      .on("mouseover", function () {
        // @ts-expect-error no-issue
        d3.select(this).attr("d", classPath.pointRadius(largePointSize));
        d3.select(this).style("stroke-width", "10px");
        tooltip
          .html(`Dip: ${dipAngle}°, Dip Direction: ${dipDirection}°`)
          .style("display", "block");
      })
      .on("mousemove", function (event) {
        tooltip
          .style("left", event.pageX + 10 + "px")
          .style("top", event.pageY + 10 + "px");
      })
      .on("mouseout", function () {
        // @ts-expect-error no-issue
        d3.select(this).attr("d", classPath.pointRadius(normalPointSize));
        d3.select(this).style("stroke-width", originalStrokeWidth);
        tooltip.style("display", "none");
      });
  }

  /**
   * Plot a linear measurement as a Point on the stereonet.
   */
  addLine(dipAngle: number, dipDirection: number, color?: string | null) {
    // Validate the dip angle and dip direction
    if (!this._validateDipDirection(dipAngle, dipDirection)) {
      return;
    }

    const id = this.lines.size;

    const style = color ? this._createCustomColorStyle(color, "line") : this.getStyle("data_line");

    const point = {
      type: "Point",
      coordinates: [0, 90 - dipAngle],
    } as PoleRepresentation;

    const path = this.g
      .append("path")
      .datum(point)
      .attr("style", style)
      .attr(
        "transform",
        `${this._elementTransformString()}  rotate(${dipDirection})`
      )
      .attr("data-id", id);

    if (this.animations) {
      path
        .attr("d", this.path.pointRadius(0))
        .style("opacity", 0) // Start with opacity 0 for animation
        .transition() // Add transition for animation
        .duration(this.animations.duration) // Animation duration in milliseconds
        .attr("d", this.path.pointRadius(this.pointSize))
        .style("opacity", 1); // Fade in the plane
    } else {
      path.attr("d", this.path.pointRadius(this.pointSize));
    }

    this._addLineHoverInteraction(path, dipAngle, dipDirection);

    this.lines.set(id.toString(), {
      dipAngle,
      dipDirection,
      path: path as LinePath,
      color: color || null, // Store the actual color, or null if undefined/null
    });

    return id;
  }

  removeLine(lineId: number) {
    const strId = lineId.toString();

    if (this.lines.has(strId)) {
      this.lines.get(strId)?.path.remove();
      this.lines.delete(strId);
    }
  }

  getLines() {
    return Array.from(this.lines).map(line => {
      return { id: line[0], path: line[1] };
    });
  }
}
