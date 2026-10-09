/* ============================================================
   Strain-Engineered Bands — physics model + rendering
   All deformation-potential constants below are representative
   teaching values (correct order of magnitude and correct sign
   of the physical trend), not a precision materials database.
   See the "Model & parameters" section of the page for sources.
   ============================================================ */

(function () {
  "use strict";

  /* ---------------- material library ---------------- */
  const MATERIALS = {
    Si: {
      name: "Silicon (Si)",
      system: "Diamond cubic, Fd3̄m — indirect gap",
      Eg0: 1.12,
      aGap: -8.0,
      hasValley: true,
      xiU: 9.16,
      valleyNote: "6 equivalent Δ valleys split 2 (Δ₂, ∥ stress) + 4 (Δ₄, ⊥ stress)",
      valleyLabels: ["Δ₂ (∥)", "Δ₄ (⊥)"],
      valleyShort: ["Δ₂", "Δ₄"],
      bVB: -2.1,
      vbLabels: ["Heavy-hole-like (HH)", "Light-hole-like (LH)"],
      vbShort: ["HH", "LH"],
      phononOmega0: 520.5,
      phononHydroCoeff: -4.0,
      phononSplitCoeff: 5.0,
      phononKind: "cubic",
      phononLabels: ["Singlet (p-like)", "Doublet (s-like)"],
    },
    Ge: {
      name: "Germanium (Ge)",
      system: "Diamond cubic, Fd3̄m — indirect gap",
      Eg0: 0.66,
      aGap: -9.5,
      hasValley: true,
      xiU: 16.2,
      valleyNote: "4 equivalent L valleys along ⟨111⟩ split under uniaxial stress",
      valleyLabels: ["L∥", "L⊥ (×3)"],
      valleyShort: ["L∥", "L⊥"],
      bVB: -2.9,
      vbLabels: ["Heavy-hole-like (HH)", "Light-hole-like (LH)"],
      vbShort: ["HH", "LH"],
      phononOmega0: 300.5,
      phononHydroCoeff: -3.0,
      phononSplitCoeff: 4.0,
      phononKind: "cubic",
      phononLabels: ["Singlet (p-like)", "Doublet (s-like)"],
    },
    GaAs: {
      name: "Gallium Arsenide (GaAs)",
      system: "Zinc-blende, F4̄3m — direct gap",
      Eg0: 1.42,
      aGap: -8.5,
      hasValley: false,
      valleyNote: "Γ-point conduction minimum is singly degenerate — no valley splitting",
      valleyLabels: ["Γ (conduction edge)", ""],
      valleyShort: ["Γ", ""],
      bVB: -1.7,
      vbLabels: ["Heavy-hole-like (HH)", "Light-hole-like (LH)"],
      vbShort: ["HH", "LH"],
      phononOmega0: 268.5,
      phononHydroCoeff: -3.5,
      phononSplitCoeff: 4.5,
      phononKind: "cubic",
      phononLabels: ["Singlet (p-like)", "Doublet (s-like)"],
    },
    GaN: {
      name: "Gallium Nitride (GaN)",
      system: "Wurtzite, P6₃mc — direct gap",
      Eg0: 3.40,
      aGap: -6.0,
      hasValley: false,
      valleyNote: "Γ-point conduction minimum is singly degenerate — no valley splitting",
      valleyLabels: ["Γ (conduction edge)", ""],
      valleyShort: ["Γ", ""],
      bVB: -2.0,
      vbLabels: ["Upper VB (Γ₉-like)", "Lower VB (Γ₇-like)"],
      vbShort: ["Γ₉", "Γ₇"],
      phononOmega0: 567.6,
      phononHydroCoeff: -3.2,
      phononSplitCoeff: 6.0,
      phononKind: "hex",
      phononLabels: ["E₂(high)⁺", "E₂(high)⁻"],
    },
  };

  const POISSON = 0.30; // used only to relate lateral/axial strain under uniaxial loading

  const state = {
    material: "Si",
    mode: "hydrostatic", // 'hydrostatic' | 'uniaxial'
    strain: 0, // percent, -2..2
  };

  /* ---------------- core physics ---------------- */

  // Decompose the applied strain into a hydrostatic (volume) part and a
  // shear (symmetry-breaking) part, both in percent.
  function decompose(strainPct, mode) {
    if (mode === "hydrostatic") {
      return { hydro: strainPct, shear: 0 };
    }
    // Uniaxial: axial strain = strainPct, lateral strain = -ν·strainPct (free-standing bar)
    const hydro = strainPct * (1 - 2 * POISSON); // ≈ 0.4 × strainPct
    const shear = strainPct; // deviatoric component driving the splitting
    return { hydro, shear };
  }

  function computeState(materialKey, mode, strainPct) {
    const m = MATERIALS[materialKey];
    const { hydro, shear } = decompose(strainPct, mode);
    const dEgHydro = m.aGap * (hydro / 100); // eV

    let valleyA = null, valleyB = null, valleySplit = 0;
    if (m.hasValley) {
      valleySplit = m.xiU * (shear / 100); // eV, full splitting scale
      valleyA = dEgHydro - (2 / 3) * valleySplit; // Δ2 (∥ stress)
      valleyB = dEgHydro + (1 / 3) * valleySplit; // Δ4 (⊥ stress)
    } else {
      valleyA = dEgHydro;
      valleyB = dEgHydro;
    }

    const vbShift = -0.5 * dEgHydro; // simplified symmetric CB/VB split of the hydrostatic shift
    const vbSplit = m.bVB * (shear / 100);
    const vbA = vbShift + vbSplit; // HH-like / upper
    const vbB = vbShift - vbSplit; // LH-like / lower

    const omegaHydro = m.phononHydroCoeff * hydro;
    const omegaSplit = m.phononSplitCoeff * shear;
    const phononA = m.phononOmega0 + omegaHydro + omegaSplit / 2;
    const phononB = m.phononOmega0 + omegaHydro - omegaSplit / 2;

    return {
      m, hydro, shear, dEgHydro,
      valleyA, valleyB, valleySplit,
      vbA, vbB, vbSplit,
      phononA, phononB,
      gapShift: dEgHydro,
      effectiveGap: m.Eg0 + dEgHydro,
    };
  }

  /* ---------------- small DOM/SVG helpers ---------------- */
  const NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs) {
    const el = document.createElementNS(NS, tag);
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function fmt(x, d) { return x.toFixed(d === undefined ? 2 : d); }
  function strainTone(pct) {
    if (Math.abs(pct) < 1e-6) return "zero";
    return pct > 0 ? "tensile" : "compressive";
  }
  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  /* ---------------- lattice + electron-cloud schematic ---------------- */
  const latticeSvg = document.getElementById("lattice-svg");
  const EXAGGERATION = 9; // visual-only amplification so ±2% strain is legible

  function drawLattice(data) {
    clear(latticeSvg);
    const W = 420, H = 300;
    latticeSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const ink = cssVar("--ink"), faint = cssVar("--ink-faint");
    const tensile = cssVar("--tensile"), compressive = cssVar("--compressive");
    const strainColor = data.hydro + data.shear === 0 ? faint : (state.strain > 0 ? tensile : state.strain < 0 ? compressive : faint);

    const cols = 5, rows = 4, base = 42;
    const pct = state.strain / 100;
    let exx, eyy;
    if (state.mode === "hydrostatic") {
      exx = eyy = pct * EXAGGERATION;
    } else {
      exx = pct * EXAGGERATION;         // strain axis = horizontal
      eyy = -POISSON * exx;             // lateral relaxation
    }
    const dx = base * (1 + exx);
    const dy = base * (1 + eyy);

    const gridW = dx * (cols - 1), gridH = dy * (rows - 1);
    const ox = (W - gridW) / 2, oy = (H - gridH) / 2 + 6;

    const g = svgEl("g", {});
    latticeSvg.appendChild(g);

    function pos(i, j) { return [ox + i * dx, oy + j * dy]; }

    // bonds
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [x, y] = pos(i, j);
        if (i < cols - 1) {
          const [x2, y2] = pos(i + 1, j);
          g.appendChild(svgEl("line", { x1: x, y1: y, x2: x2, y2: y2, stroke: faint, "stroke-width": 1.4, opacity: 0.8 }));
        }
        if (j < rows - 1) {
          const [x2, y2] = pos(i, j + 1);
          g.appendChild(svgEl("line", { x1: x, y1: y, x2: x2, y2: y2, stroke: faint, "stroke-width": 1.4, opacity: 0.8 }));
        }
      }
    }

    // electron-cloud overlap blobs on horizontal bonds (overlap ~ inverse of bond stretch)
    const overlapScale = Math.max(0.35, Math.min(1.8, 1 / (1 + exx)));
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols - 1; i++) {
        const [x, y] = pos(i, j);
        const [x2] = pos(i + 1, j);
        const mx = (x + x2) / 2;
        g.appendChild(svgEl("ellipse", {
          cx: mx, cy: y, rx: (dx / 2) * overlapScale * 0.95, ry: 10 * overlapScale,
          fill: strainColor, opacity: 0.16,
        }));
      }
    }

    // atoms (two-tone to suggest a diatomic/zinc-blende-like basis)
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const [x, y] = pos(i, j);
        const isA = (i + j) % 2 === 0;
        g.appendChild(svgEl("circle", {
          cx: x, cy: y, r: isA ? 7.5 : 6,
          fill: isA ? cssVar("--accent") : cssVar("--surface"),
          stroke: ink, "stroke-width": 1.3,
        }));
      }
    }

    // strain-axis arrows
    const arrowY = oy + gridH + 26;
    if (Math.abs(state.strain) > 0.02) {
      const sign = state.strain > 0 ? 1 : -1;
      const ax1 = ox, ax2 = ox + gridW;
      [ax1, ax2].forEach((ax, idx) => {
        const dir = idx === 0 ? -sign : sign;
        g.appendChild(svgEl("line", {
          x1: ax, y1: arrowY, x2: ax + dir * 16, y2: arrowY,
          stroke: strainColor, "stroke-width": 2, "marker-end": "url(#arrowhead)",
        }));
      });
      if (state.mode === "uniaxial") {
        const vy1 = oy, vy2 = oy + gridH;
        const vdir = -sign * POISSON > 0 ? 1 : -1;
        [vy1, vy2].forEach((ay, idx) => {
          const dir = idx === 0 ? -vdir : vdir;
          g.appendChild(svgEl("line", {
            x1: ox + gridW + 22, y1: ay, x2: ox + gridW + 22, y2: ay + dir * 10,
            stroke: compressive, "stroke-width": 1.6, opacity: 0.65, "marker-end": "url(#arrowhead-sm)",
          }));
        });
      }
    }

    // defs for arrowheads
    const defs = svgEl("defs", {});
    const mk = svgEl("marker", { id: "arrowhead", markerWidth: 6, markerHeight: 6, refX: 4, refY: 3, orient: "auto" });
    mk.appendChild(svgEl("path", { d: "M0,0 L6,3 L0,6 Z", fill: strainColor }));
    const mk2 = svgEl("marker", { id: "arrowhead-sm", markerWidth: 5, markerHeight: 5, refX: 3, refY: 2.5, orient: "auto" });
    mk2.appendChild(svgEl("path", { d: "M0,0 L5,2.5 L0,5 Z", fill: compressive }));
    defs.appendChild(mk); defs.appendChild(mk2);
    latticeSvg.appendChild(defs);

    // caption label
    const label = svgEl("text", { x: W / 2, y: H - 8, "text-anchor": "middle", fill: faint, "font-size": 10.5, "font-family": "var(--font-mono)" });
    label.textContent = `bond-length change exaggerated ×${EXAGGERATION} for visibility`;
    latticeSvg.appendChild(label);
  }

  /* ---------------- live band-edge level diagram ---------------- */
  const bandSvg = document.getElementById("band-svg");

  function drawBandDiagram(data) {
    clear(bandSvg);
    const W = 420, H = 300;
    bandSvg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const ink = cssVar("--ink"), faint = cssVar("--ink-faint"), muted = cssVar("--ink-muted");
    const seriesA = cssVar("--series-a"), seriesB = cssVar("--series-b");

    const top = 26, bottom = H - 34;
    const cbBase = top + 46;   // baseline for unstrained CB
    const vbBase = bottom - 46; // baseline for unstrained VB
    const scale = 420; // px per eV (exaggerated for legibility)

    const g = svgEl("g", {});
    bandSvg.appendChild(g);

    // vertical energy axis
    g.appendChild(svgEl("line", { x1: 46, y1: top, x2: 46, y2: bottom, stroke: faint, "stroke-width": 1 }));
    const axisLabel = svgEl("text", { x: 14, y: (top + bottom) / 2, "text-anchor": "middle", fill: muted, "font-size": 10.5, "font-family": "var(--font-mono)", transform: `rotate(-90 14 ${(top + bottom) / 2})` });
    axisLabel.textContent = "Energy →";
    g.appendChild(axisLabel);

    const xA = 150, xB = 300, half = 56;

    function line(y, x1, x2, color, w) {
      g.appendChild(svgEl("line", { x1, y1: y, x2, y2: y, stroke: color, "stroke-width": w || 4, "stroke-linecap": "round" }));
    }
    function tag(x, y, text, color, anchor) {
      const t = svgEl("text", { x, y, "text-anchor": anchor || "middle", fill: color, "font-size": 11, "font-family": "var(--font-mono)" });
      t.textContent = text;
      g.appendChild(t);
    }

    // Conduction band edges
    const yA1 = cbBase - data.valleyA * scale;
    const yA2 = cbBase - data.valleyB * scale;
    const sameCB = Math.abs(yA1 - yA2) < 1.2;
    if (sameCB) {
      line(yA1, xA - half, xA + half, ink, 5);
      tag(xA, yA1 - 10, data.m.hasValley ? `${data.m.valleyShort[0]} = ${data.m.valleyShort[1]}` : data.m.valleyShort[0], muted);
    } else {
      line(yA1, xA - half, xA + half, seriesA, 5);
      line(yA2, xA - half, xA + half, seriesB, 5);
      tag(xA - half, yA1 - 9, data.m.valleyShort[0], seriesA, "start");
      tag(xA - half, yA2 + 16, data.m.valleyShort[1], seriesB, "start");
    }
    tag(xA, bottom + 20, "Conduction edge", muted);

    // Valence band edges
    const yB1 = vbBase - data.vbA * scale;
    const yB2 = vbBase - data.vbB * scale;
    const sameVB = Math.abs(yB1 - yB2) < 1.2;
    if (sameVB) {
      line(yB1, xB - half, xB + half, ink, 5);
      tag(xB, yB1 - 10, `${data.m.vbShort[0]} = ${data.m.vbShort[1]}`, muted);
    } else {
      line(yB1, xB - half, xB + half, seriesA, 5);
      line(yB2, xB - half, xB + half, seriesB, 5);
      tag(xB - half, yB1 - 9, data.m.vbShort[0], seriesA, "start");
      tag(xB - half, yB2 + 16, data.m.vbShort[1], seriesB, "start");
    }
    tag(xB, bottom + 20, "Valence edge", muted);

    // gap arrow + ΔEg readout between the two groups' nearest edges
    const cbMin = Math.min(yA1, yA2), vbMax = Math.max(yB1, yB2);
    const midx = (xA + xB) / 2;
    g.appendChild(svgEl("line", { x1: midx, y1: cbMin, x2: midx, y2: vbMax, stroke: faint, "stroke-width": 1, "stroke-dasharray": "3 3" }));
    const egLabel = svgEl("text", { x: midx, y: (cbMin + vbMax) / 2, "text-anchor": "middle", fill: ink, "font-size": 11.5, "font-family": "var(--font-mono)", "font-weight": 600 });
    const effGap = data.m.Eg0 + (data.valleyA < data.valleyB ? data.valleyA : data.valleyB) - (data.vbA > data.vbB ? data.vbA : data.vbB);
    egLabel.setAttribute("dy", "-4");
    egLabel.textContent = `${fmt(effGap, 3)} eV`;
    g.appendChild(egLabel);

    // unstrained reference ticks
    g.appendChild(svgEl("line", { x1: 40, y1: cbBase, x2: 52, y2: cbBase, stroke: faint, "stroke-width": 1 }));
    g.appendChild(svgEl("line", { x1: 40, y1: vbBase, x2: 52, y2: vbBase, stroke: faint, "stroke-width": 1 }));
    tag(60, cbBase + 3, "E_c⁰", faint, "start");
    tag(60, vbBase + 3, "E_v⁰", faint, "start");
  }

  /* ---------------- generic XY line chart with hover ---------------- */
  const CW = 480, CH = 230, M = { left: 48, right: 14, top: 14, bottom: 30 };

  function makeChart(svg, opts) {
    // opts: {getSeries(materialKey,mode) -> [{label,colorVar,points:[{x,y}]}], yLabel, xDomain:[lo,hi]}
    svg.setAttribute("viewBox", `0 0 ${CW} ${CH}`);
    let series = [];
    let yDomain = [-1, 1];
    const xDomain = opts.xDomain;

    function xPix(x) { return M.left + (x - xDomain[0]) / (xDomain[1] - xDomain[0]) * (CW - M.left - M.right); }
    function yPix(y) { return CH - M.bottom - (y - yDomain[0]) / (yDomain[1] - yDomain[0]) * (CH - M.top - M.bottom); }

    const staticLayer = svgEl("g", { class: "static-layer" });
    const dynamicLayer = svgEl("g", { class: "dynamic-layer" });
    const hoverLayer = svgEl("g", { class: "hover-layer" });

    function rebuild() {
      series = opts.getSeries(state.material, state.mode);
      let lo = Infinity, hi = -Infinity;
      series.forEach(s => s.points.forEach(p => { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }));
      if (!isFinite(lo)) { lo = -1; hi = 1; }
      if (hi - lo < 1e-6) { hi += 0.5; lo -= 0.5; }
      const pad = (hi - lo) * 0.18 + 1e-9;
      yDomain = [lo - pad, hi + pad];

      clear(svg);
      clear(staticLayer);

      // gridlines (y)
      const nTicks = 4;
      for (let i = 0; i <= nTicks; i++) {
        const yv = yDomain[0] + (yDomain[1] - yDomain[0]) * i / nTicks;
        const yp = yPix(yv);
        staticLayer.appendChild(svgEl("line", { class: "grid-line", x1: M.left, y1: yp, x2: CW - M.right, y2: yp }));
        const t = svgEl("text", { class: "axis", x: M.left - 8, y: yp + 3, "text-anchor": "end" });
        t.textContent = opts.yFmt ? opts.yFmt(yv) : fmt(yv, 2);
        staticLayer.appendChild(t);
      }
      // x axis ticks
      [xDomain[0], xDomain[0] / 2, 0, xDomain[1] / 2, xDomain[1]].forEach(xv => {
        const xp = xPix(xv);
        const t = svgEl("text", { class: "axis", x: xp, y: CH - M.bottom + 16, "text-anchor": "middle" });
        t.textContent = (xv > 0 ? "+" : "") + fmt(xv, 1) + "%";
        staticLayer.appendChild(t);
      });
      staticLayer.appendChild(svgEl("line", { class: "axis-line", x1: M.left, y1: CH - M.bottom, x2: CW - M.right, y2: CH - M.bottom }));
      staticLayer.appendChild(svgEl("line", { class: "axis-line", x1: M.left, y1: M.top, x2: M.left, y2: CH - M.bottom }));
      // zero-strain reference line
      const x0 = xPix(0);
      staticLayer.appendChild(svgEl("line", { x1: x0, y1: M.top, x2: x0, y2: CH - M.bottom, stroke: cssVar("--grid-line"), "stroke-width": 1.2, "stroke-dasharray": "2 4" }));

      // series lines
      series.forEach(s => {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${xPix(p.x)},${yPix(p.y)}`).join(" ");
        staticLayer.appendChild(svgEl("path", { d, fill: "none", stroke: cssVar(s.colorVar), "stroke-width": 2.5, "stroke-linecap": "round" }));
      });

      svg.appendChild(staticLayer);
      svg.appendChild(dynamicLayer);
      svg.appendChild(hoverLayer);
      updateMarker();
    }

    function valueAt(s, x) {
      const pts = s.points;
      for (let i = 0; i < pts.length - 1; i++) {
        if (x >= pts[i].x && x <= pts[i + 1].x) {
          const t = (x - pts[i].x) / (pts[i + 1].x - pts[i].x || 1);
          return pts[i].y + t * (pts[i + 1].y - pts[i].y);
        }
      }
      return pts[pts.length - 1].y;
    }

    function updateMarker() {
      clear(dynamicLayer);
      const x = Math.max(xDomain[0], Math.min(xDomain[1], state.strain));
      const xp = xPix(x);
      const markColor = strainTone(x) === "tensile" ? cssVar("--tensile") : strainTone(x) === "compressive" ? cssVar("--compressive") : cssVar("--ink-faint");
      dynamicLayer.appendChild(svgEl("line", { x1: xp, y1: M.top, x2: xp, y2: CH - M.bottom, stroke: markColor, "stroke-width": 1.4 }));
      series.forEach(s => {
        const y = valueAt(s, x);
        dynamicLayer.appendChild(svgEl("circle", { class: "marker-dot", cx: xp, cy: yPix(y), r: 4.5, fill: cssVar(s.colorVar) }));
      });
    }

    function showHover(evt) {
      const rect = svg.getBoundingClientRect();
      const px = (evt.clientX - rect.left) / rect.width * CW;
      const xv = xDomain[0] + (px - M.left) / (CW - M.left - M.right) * (xDomain[1] - xDomain[0]);
      if (xv < xDomain[0] || xv > xDomain[1]) { clear(hoverLayer); return; }
      clear(hoverLayer);
      const xp = xPix(xv);
      hoverLayer.appendChild(svgEl("line", { class: "crosshair-line", x1: xp, y1: M.top, x2: xp, y2: CH - M.bottom }));

      const lines = series.map(s => `${s.label}: ${opts.yFmt ? opts.yFmt(valueAt(s, xv)) : fmt(valueAt(s, xv), 3)}`);
      lines.unshift(`strain: ${(xv > 0 ? "+" : "") + fmt(xv, 2)}%`);

      const boxW = 150, boxH = 16 + lines.length * 14;
      let bx = xp + 10;
      if (bx + boxW > CW - M.right) bx = xp - boxW - 10;
      let by = M.top + 4;
      const box = svgEl("rect", { class: "tooltip-box", x: bx, y: by, width: boxW, height: boxH, rx: 6 });
      hoverLayer.appendChild(box);
      lines.forEach((line, i) => {
        const t = svgEl("text", { class: "tooltip-text", x: bx + 10, y: by + 16 + i * 14 });
        t.textContent = line;
        hoverLayer.appendChild(t);
      });
    }

    svg.addEventListener("mousemove", showHover);
    svg.addEventListener("mouseleave", () => clear(hoverLayer));
    svg.addEventListener("touchmove", (e) => { if (e.touches[0]) showHover(e.touches[0]); }, { passive: true });

    return { rebuild, updateMarker };
  }

  /* chart definitions */
  const strainXDomain = [-2, 2];

  function seriesForCurrentMaterial(fn) {
    return (materialKey, mode) => {
      const pts = [];
      const steps = 2;
      for (let i = 0; i <= steps; i++) {
        const x = strainXDomain[0] + (strainXDomain[1] - strainXDomain[0]) * i / steps;
        pts.push(x);
      }
      return fn(materialKey, mode, pts);
    };
  }

  const chartGap = makeChart(document.getElementById("chart-gap"), {
    xDomain: strainXDomain,
    yFmt: (v) => fmt(v, 3),
    getSeries: (materialKey, mode) => {
      const pts = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).gapShift }));
      return [{ label: "ΔE_g", colorVar: "--accent", points: pts }];
    },
  });

  const chartValley = makeChart(document.getElementById("chart-valley"), {
    xDomain: strainXDomain,
    yFmt: (v) => fmt(v, 3),
    getSeries: (materialKey, mode) => {
      const m = MATERIALS[materialKey];
      const ptsA = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).valleyA }));
      const ptsB = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).valleyB }));
      if (!m.hasValley) return [{ label: m.valleyLabels[0], colorVar: "--accent", points: ptsA }];
      return [
        { label: m.valleyLabels[0], colorVar: "--series-a", points: ptsA },
        { label: m.valleyLabels[1], colorVar: "--series-b", points: ptsB },
      ];
    },
  });

  const chartVB = makeChart(document.getElementById("chart-vb"), {
    xDomain: strainXDomain,
    yFmt: (v) => fmt(v, 3),
    getSeries: (materialKey, mode) => {
      const m = MATERIALS[materialKey];
      const ptsA = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).vbA }));
      const ptsB = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).vbB }));
      return [
        { label: m.vbShort[0], colorVar: "--series-a", points: ptsA },
        { label: m.vbShort[1], colorVar: "--series-b", points: ptsB },
      ];
    },
  });

  const chartPhonon = makeChart(document.getElementById("chart-phonon"), {
    xDomain: strainXDomain,
    yFmt: (v) => fmt(v, 1),
    getSeries: (materialKey, mode) => {
      const m = MATERIALS[materialKey];
      const ptsA = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).phononA }));
      const ptsB = [-2, -1, 0, 1, 2].map(x => ({ x, y: computeState(materialKey, mode, x).phononB }));
      return [
        { label: m.phononLabels[0], colorVar: "--series-a", points: ptsA },
        { label: m.phononLabels[1], colorVar: "--series-b", points: ptsB },
      ];
    },
  });

  const allCharts = [chartGap, chartValley, chartVB, chartPhonon];

  /* ---------------- legends + labels that depend on material ---------------- */
  function updateLegendsAndLabels(data) {
    const m = data.m;
    document.getElementById("legend-valley").innerHTML = m.hasValley
      ? `<span><i style="background:var(--series-a)"></i>${m.valleyLabels[0]}</span><span><i style="background:var(--series-b)"></i>${m.valleyLabels[1]}</span>`
      : `<span><i style="background:var(--accent)"></i>${m.valleyLabels[0]}</span>`;
    document.getElementById("valley-note").textContent = m.valleyNote;

    document.getElementById("legend-vb").innerHTML =
      `<span><i style="background:var(--series-a)"></i>${m.vbLabels[0]}</span><span><i style="background:var(--series-b)"></i>${m.vbLabels[1]}</span>`;

    document.getElementById("legend-phonon").innerHTML =
      `<span><i style="background:var(--series-a)"></i>${m.phononLabels[0]}</span><span><i style="background:var(--series-b)"></i>${m.phononLabels[1]}</span>`;
    document.getElementById("phonon-note").textContent = m.phononKind === "hex"
      ? "Doubly-degenerate E₂(high) mode (D₆ₕ point group) — the textbook case of true E₂ symmetry breaking."
      : "Triply-degenerate Γ-point optical mode (Oₕ/Td point group) splits into a singlet + doublet — the cubic analogue of E₂ splitting.";

    document.getElementById("material-system").textContent = m.system;
    document.getElementById("eg0-readout").textContent = `${fmt(m.Eg0, 2)} eV`;
    document.getElementById("eg-now-readout").textContent = `${fmt(m.Eg0 + data.gapShift, 3)} eV`;
  }

  /* ---------------- parameter table ---------------- */
  function buildParamTable() {
    const tbody = document.getElementById("param-tbody");
    clear(tbody);
    Object.keys(MATERIALS).forEach(key => {
      const m = MATERIALS[key];
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${m.name}</td>
        <td>${fmt(m.Eg0, 2)}</td>
        <td>${fmt(m.aGap, 1)}</td>
        <td>${m.hasValley ? fmt(m.xiU, 1) : "—"}</td>
        <td>${fmt(m.bVB, 1)}</td>
        <td>${fmt(m.phononOmega0, 1)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ---------------- UI wiring ---------------- */
  function strainLabel(pct) {
    const sign = pct > 0 ? "+" : "";
    return `${sign}${fmt(pct, 2)}%`;
  }

  function render() {
    const data = computeState(state.material, state.mode, state.strain);
    drawLattice(data);
    drawBandDiagram(data);
    updateLegendsAndLabels(data);

    const readout = document.getElementById("strain-readout");
    readout.textContent = strainLabel(state.strain);
    readout.className = "strain-readout " + strainTone(state.strain);

    const stateBadge = document.getElementById("state-badge");
    stateBadge.innerHTML =
      `material = <b>${data.m.name}</b> &nbsp;·&nbsp; mode = <b>${state.mode}</b><br>` +
      `ε = <b>${strainLabel(state.strain)}</b> &nbsp;·&nbsp; ε_hydro = <b>${fmt(data.hydro, 2)}%</b> &nbsp;·&nbsp; ε_shear = <b>${fmt(data.shear, 2)}%</b><br>` +
      `ΔE_g = <b>${fmt(data.gapShift * 1000, 1)} meV</b>`;

    allCharts.forEach(c => c.updateMarker());
  }

  function rebuildCharts() {
    allCharts.forEach(c => c.rebuild());
  }

  function init() {
    buildParamTable();

    const materialSelect = document.getElementById("material-select");
    materialSelect.addEventListener("change", () => {
      state.material = materialSelect.value;
      rebuildCharts();
      render();
    });

    const modeButtons = document.querySelectorAll("#mode-seg button");
    modeButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        state.mode = btn.dataset.mode;
        modeButtons.forEach(b => b.setAttribute("aria-pressed", String(b === btn)));
        rebuildCharts();
        render();
      });
    });

    const strainSlider = document.getElementById("strain-slider");
    strainSlider.addEventListener("input", () => {
      state.strain = parseFloat(strainSlider.value);
      render();
    });

    document.getElementById("reset-btn").addEventListener("click", () => {
      state.material = "Si"; state.mode = "hydrostatic"; state.strain = 0;
      materialSelect.value = "Si";
      modeButtons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === "hydrostatic")));
      strainSlider.value = "0";
      rebuildCharts();
      render();
    });

    // theme toggle
    const themeBtn = document.getElementById("theme-toggle");
    function applyStoredTheme() {
      try {
        const saved = localStorage.getItem("strain-report-theme");
        if (saved === "light" || saved === "dark") {
          document.documentElement.setAttribute("data-theme", saved);
          themeBtn.textContent = saved === "dark" ? "☾ dark" : "☀ light";
        }
      } catch (e) { /* storage unavailable; ignore */ }
    }
    themeBtn.addEventListener("click", () => {
      const current = document.documentElement.getAttribute("data-theme");
      const next = current === "dark" ? "light" : current === "light" ? null : (matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark");
      if (next) document.documentElement.setAttribute("data-theme", next);
      else document.documentElement.removeAttribute("data-theme");
      themeBtn.textContent = next === "dark" ? "☾ dark" : next === "light" ? "☀ light" : "auto";
      try { localStorage.setItem("strain-report-theme", next || "auto"); } catch (e) {}
      requestAnimationFrame(() => { rebuildCharts(); render(); });
    });
    applyStoredTheme();

    rebuildCharts();
    render();
    window.addEventListener("resize", () => {}); // SVGs are viewBox-scaled, no JS needed
  }

  document.addEventListener("DOMContentLoaded", init);
})();
