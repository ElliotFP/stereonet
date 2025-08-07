import { Stereonet } from "../src";

const streonet = new Stereonet({ selector: "body", size: 900 });

// Generate around 40 random poles (lines) with random colors and add them to the stereonet
function randomColor() {
  // Generate a random hex color
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`;
}

for (let i = 0; i < 40; i++) {
  // Dip: 0 < dip < 90, Dip direction: 0 <= dipDir < 360
  const dip = +(Math.random() * 89.9 + 0.1).toFixed(2);
  const dipDir = +(Math.random() * 360).toFixed(2);
  const color = randomColor();
  streonet.addLine(dip, dipDir, color);
}

// Also add some random planes with random colors
for (let i = 0; i < 10; i++) {
  const dip = +(Math.random() * 89.9 + 0.1).toFixed(2);
  const dipDir = +(Math.random() * 360).toFixed(2);
  const color = randomColor();
  streonet.addPlane(dip, dipDir, color);
}
