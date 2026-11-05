"use client";
/* eslint-disable react-hooks/exhaustive-deps, react-hooks/refs -- the Fabric canvas is a mutable external store; a version counter re-renders on change. */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ActiveSelection,
  Canvas,
  Circle,
  Color,
  FabricImage,
  Group,
  Line,
  Polygon,
  Rect,
  Shadow,
  StaticCanvas,
  Textbox,
  Triangle,
  util,
  type FabricObject,
} from "fabric";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Copy,
  CopyPlus,
  Crop as CropIcon,
  Download,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Group as GroupIcon,
  GripVertical,
  Italic,
  Layers,
  LayoutTemplate,
  Lock,
  Maximize,
  Minus,
  Paintbrush,
  Palette,
  Plus,
  Redo2,
  RotateCcw,
  Shapes,
  Sparkles,
  Trash2,
  Type,
  Underline,
  Undo2,
  Ungroup,
  Upload,
  X,
} from "lucide-react";
import { AppTopbar } from "@/components/dashboard/app-topbar";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Design, DesignSummary } from "@/lib/design-studio/store";
import { ensureFonts, fontsInJson, preloadFontCss, SYSTEM_FONTS, WEB_FONTS } from "@/lib/design-studio/fonts";
import { drawGuides, snapMoving, type Guide } from "@/lib/design-studio/snap";
import { cropFromLocalBox } from "@/lib/design-studio/crop";
import { pagesFromDoc } from "@/lib/design-studio/doc";

// Non-default props that must survive save/undo.
const EXTRA_PROPS = [
  "name",
  "lockMovementX",
  "lockMovementY",
  "lockScalingX",
  "lockScalingY",
  "lockRotation",
  "hasControls",
];
const HISTORY_LIMIT = 60;
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

const SIZE_PRESETS = [
  { label: "Instagram post", width: 1080, height: 1080 },
  { label: "Instagram story", width: 1080, height: 1920 },
  { label: "Facebook post", width: 1200, height: 630 },
  { label: "YouTube thumbnail", width: 1280, height: 720 },
  { label: "Presentation", width: 1920, height: 1080 },
  { label: "A4 portrait", width: 2480, height: 3508 },
];

const SWATCHES = [
  "#ffffff", "#000000", "#111827", "#6b7280", "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#ec4899", "#fef3c7",
];

type Tab = "templates" | "elements" | "text" | "uploads" | "background" | "layers" | "effects";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "templates", label: "Design", icon: LayoutTemplate },
  { id: "elements", label: "Elements", icon: Shapes },
  { id: "text", label: "Text", icon: Type },
  { id: "uploads", label: "Uploads", icon: Upload },
  { id: "background", label: "Background", icon: Palette },
  { id: "layers", label: "Layers", icon: Layers },
];

function toHex(value: unknown): string {
  if (typeof value !== "string" || !value) return "#000000";
  try {
    return "#" + new Color(value).toHex().slice(0, 6);
  } catch {
    return "#000000";
  }
}

function starPoints(outer: number, inner: number, spikes = 5) {
  return Array.from({ length: spikes * 2 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / spikes) * i - Math.PI / 2;
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });
}

function layerLabel(o: FabricObject): string {
  if (o instanceof Textbox) return o.text?.slice(0, 24) || "Text";
  if (o instanceof FabricImage) return "Image";
  return o.type.charAt(0).toUpperCase() + o.type.slice(1);
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

// Starter layouts, sized relative to the page so they work on any preset.
// `fonts` must be loaded before `build`, since Textbox measures glyphs on construction.
type Template = { name: string; bg: string; fonts: string[]; build: (w: number, h: number) => FabricObject[] };
const TEMPLATES: Template[] = [
  {
    name: "Announcement",
    bg: "#111827",
    fonts: ["Bebas Neue", "Inter"],
    build: (w, h) => {
      const u = Math.min(w, h);
      return [
        new Rect({ left: w / 2, top: h * 0.3, width: u * 0.12, height: u * 0.012, fill: "#f59e0b" }),
        new Textbox("BIG NEWS", { left: w / 2, top: h * 0.45, width: w * 0.8, fontSize: u * 0.18, fontFamily: "Bebas Neue", fill: "#ffffff", textAlign: "center" }),
        new Textbox("Something new is coming. Stay tuned.", { left: w / 2, top: h * 0.62, width: w * 0.7, fontSize: u * 0.04, fontFamily: "Inter", fill: "#d1d5db", textAlign: "center" }),
      ];
    },
  },
  {
    name: "Quote",
    bg: "#fef3c7",
    fonts: ["Playfair Display", "Inter"],
    build: (w, h) => {
      const u = Math.min(w, h);
      return [
        new Textbox("“", { left: w / 2, top: h * 0.25, width: w * 0.3, fontSize: u * 0.3, fontFamily: "Playfair Display", fill: "#f59e0b", textAlign: "center" }),
        new Textbox("Simplicity is the ultimate sophistication.", { left: w / 2, top: h * 0.5, width: w * 0.75, fontSize: u * 0.07, fontFamily: "Playfair Display", fontStyle: "italic", fill: "#111827", textAlign: "center" }),
        new Textbox("— Leonardo da Vinci", { left: w / 2, top: h * 0.72, width: w * 0.6, fontSize: u * 0.035, fontFamily: "Inter", fill: "#6b7280", textAlign: "center" }),
      ];
    },
  },
  {
    name: "Sale",
    bg: "#ef4444",
    fonts: ["Anton", "Montserrat"],
    build: (w, h) => {
      const u = Math.min(w, h);
      return [
        new Circle({ left: w / 2, top: h / 2, radius: u * 0.36, fill: "#ffffff", opacity: 0.12 }),
        new Textbox("SALE", { left: w / 2, top: h * 0.42, width: w * 0.8, fontSize: u * 0.24, fontFamily: "Anton", fill: "#ffffff", textAlign: "center" }),
        new Textbox("UP TO 50% OFF", { left: w / 2, top: h * 0.6, width: w * 0.8, fontSize: u * 0.06, fontWeight: "bold", fontFamily: "Montserrat", fill: "#fef3c7", textAlign: "center", charSpacing: 200 }),
      ];
    },
  },
  {
    name: "Minimal",
    bg: "#f8fafc",
    fonts: ["Space Grotesk"],
    build: (w, h) => {
      const u = Math.min(w, h);
      return [
        new Textbox("Your title here", { left: w / 2, top: h * 0.45, width: w * 0.8, fontSize: u * 0.09, fontFamily: "Space Grotesk", fill: "#0f172a", textAlign: "center" }),
        new Line([0, 0, u * 0.3, 0], { left: w / 2, top: h * 0.56, stroke: "#0f172a", strokeWidth: u * 0.004 }),
        new Textbox("A short supporting line", { left: w / 2, top: h * 0.63, width: w * 0.7, fontSize: u * 0.035, fontFamily: "Space Grotesk", fill: "#64748b", textAlign: "center" }),
      ];
    },
  },
];

type Page = { id: string; json: string; thumb: string; hist: { stack: string[]; i: number } };
type CropSession = { img: FabricImage; box: Rect };

const BLANK_PAGE = JSON.stringify({ objects: [], background: "#ffffff" });
const THUMB_W = 160;

function newPage(json = BLANK_PAGE): Page {
  return { id: crypto.randomUUID(), json, thumb: "", hist: { stack: [json], i: 0 } };
}

function docJson(pages: Page[]): string {
  return `{"pages":[${pages.map((p) => p.json).join(",")}]}`;
}

// Renders one page off-screen, independent of the editor's zoom and selection.
async function renderPage(json: string, w: number, h: number, opts: { format: "png" | "jpeg"; multiplier: number; quality?: number }) {
  await ensureFonts(fontsInJson(json));
  const sc = new StaticCanvas(undefined, { width: w, height: h, enableRetinaScaling: false });
  await sc.loadFromJSON(json);
  if (!sc.backgroundColor) sc.backgroundColor = "#ffffff";
  const url = sc.toDataURL({ format: opts.format, quality: opts.quality ?? 0.92, multiplier: opts.multiplier, enableRetinaScaling: false });
  await sc.dispose();
  return url;
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

export function DesignStudioPanel() {
  const stageRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fc = useRef<Canvas | null>(null);
  // Each page keeps its own undo stack; `hist` points at the current page's.
  const pages = useRef<Page[]>([newPage()]);
  const hist = useRef(pages.current[0].hist);
  const muted = useRef(false);
  const guides = useRef<Guide[]>([]);
  const designRef = useRef<DesignSummary | null>(null);
  const snapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<{ id: string; json: string } | null>(null);
  const clipboard = useRef<FabricObject | null>(null);

  const [designs, setDesigns] = useState<DesignSummary[]>([]);
  const [design, setDesign] = useState<DesignSummary | null>(null);
  const [page, setPage] = useState(0);
  const [tab, setTab] = useState<Tab | null>("templates");
  const [zoom, setZoom] = useState(0.5);
  const [fitZoom, setFitZoom] = useState(0.5);
  const [autoFit, setAutoFit] = useState(true);
  const [sel, setSel] = useState<FabricObject | null>(null);
  const [crop, setCrop] = useState<CropSession | null>(null);
  const [, setVersion] = useState(0);
  const [saveState, setSaveState] = useState<"saved" | "unsaved" | "saving">("saved");
  const [uploads, setUploads] = useState<string[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePageOpen, setDeletePageOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [dragLayer, setDragLayer] = useState<FabricObject | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  const [dragPage, setDragPage] = useState<number | null>(null);
  const [customW, setCustomW] = useState("1080");
  const [customH, setCustomH] = useState("1080");

  designRef.current = design;
  const bump = () => setVersion((v) => v + 1);

  // ---------------- Persistence ----------------
  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const job = pendingSave.current;
    if (!job) return;
    pendingSave.current = null;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/design-studio/designs/${job.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: `{"doc":${job.json}}`,
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      setSaveState(pendingSave.current ? "unsaved" : "saved");
    } catch (error) {
      // Keep the job so the next edit or switch retries it.
      pendingSave.current ??= job;
      setSaveState("unsaved");
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  }, []);

  const scheduleSave = () => {
    const d = designRef.current;
    if (!d) return;
    pendingSave.current = { id: d.id, json: docJson(pages.current) };
    setSaveState("unsaved");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => void flushSave(), 1000);
  };

  const patchMeta = async (patch: Partial<Pick<Design, "name" | "width" | "height">>) => {
    if (!design) return;
    const res = await fetch(`/api/design-studio/designs/${design.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return toast.error("Could not update design");
    const { design: updated } = (await res.json()) as { design: DesignSummary };
    setDesign(updated);
    setDesigns((list) => list.map((d) => (d.id === updated.id ? updated : d)));
  };

  // ---------------- History ----------------
  const updateThumb = () => {
    const c = fc.current;
    const cur = pages.current[page];
    if (!c || !cur) return;
    cur.thumb = c.toDataURL({ format: "jpeg", quality: 0.7, multiplier: THUMB_W / c.getWidth(), enableRetinaScaling: false });
  };

  const snapshot = () => {
    const c = fc.current;
    const h = hist.current;
    if (!c || muted.current) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = null;
    const json = JSON.stringify(c.toObject(EXTRA_PROPS));
    if (h.stack[h.i] === json) return;
    h.stack = h.stack.slice(0, h.i + 1);
    h.stack.push(json);
    if (h.stack.length > HISTORY_LIMIT) h.stack.shift();
    h.i = h.stack.length - 1;
    pages.current[page].json = json;
    updateThumb();
    scheduleSave();
    bump();
  };
  // Event handlers are bound once; route them through a ref so they see the current page.
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  const queueSnap = () => {
    if (muted.current) return;
    if (snapTimer.current) clearTimeout(snapTimer.current);
    snapTimer.current = setTimeout(() => snapshotRef.current(), 200);
  };
  const queueSnapRef = useRef(queueSnap);
  queueSnapRef.current = queueSnap;

  const loadJson = async (json: string) => {
    const c = fc.current;
    if (!c) return;
    muted.current = true;
    await ensureFonts(fontsInJson(json));
    c.discardActiveObject();
    c.clear();
    await c.loadFromJSON(json);
    if (!c.backgroundColor) c.backgroundColor = "#ffffff";
    c.requestRenderAll();
    muted.current = false;
    setSel(null);
  };

  const step = async (delta: number) => {
    const h = hist.current;
    const next = h.i + delta;
    if (crop || next < 0 || next >= h.stack.length) return;
    h.i = next;
    await loadJson(h.stack[next]);
    pages.current[page].json = h.stack[next];
    updateThumb();
    scheduleSave();
    bump();
  };

  // ---------------- Pages ----------------
  const goToPage = async (index: number) => {
    if (crop || index === page || !pages.current[index]) return;
    if (snapTimer.current) snapshot();
    hist.current = pages.current[index].hist;
    setPage(index);
    await loadJson(pages.current[index].json);
    bump();
  };

  const insertPage = async (json?: string) => {
    if (crop) return;
    if (snapTimer.current) snapshot();
    const p = newPage(json);
    if (json) p.thumb = pages.current[page].thumb;
    const at = page + 1;
    pages.current.splice(at, 0, p);
    hist.current = p.hist;
    setPage(at);
    await loadJson(p.json);
    scheduleSave();
    bump();
  };

  const deletePage = async () => {
    if (crop || pages.current.length < 2) return;
    pages.current.splice(page, 1);
    const next = Math.min(page, pages.current.length - 1);
    hist.current = pages.current[next].hist;
    setPage(next);
    await loadJson(pages.current[next].json);
    scheduleSave();
    bump();
  };

  const movePage = (from: number, to: number) => {
    if (from === to) return;
    const list = pages.current;
    const currentId = list[page].id;
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    setPage(list.findIndex((p) => p.id === currentId));
    scheduleSave();
    bump();
  };

  // ---------------- Canvas setup ----------------
  const startCropRef = useRef<(img: FabricImage) => void>(() => {});

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    preloadFontCss();
    // Create the element imperatively so StrictMode's double mount never reuses a disposed canvas.
    const el = document.createElement("canvas");
    host.appendChild(el);
    const c = new Canvas(el, { preserveObjectStacking: true, backgroundColor: "#ffffff" });
    fc.current = c;
    const syncSel = () => setSel(c.getActiveObject() ?? null);
    const onChange = () => queueSnapRef.current();
    c.on("selection:created", syncSel);
    c.on("selection:updated", syncSel);
    c.on("selection:cleared", syncSel);
    c.on("object:added", onChange);
    c.on("object:removed", onChange);
    c.on("object:modified", () => {
      onChange();
      bump();
    });
    // Hold Alt to move freely without snapping.
    c.on("object:moving", (e) => {
      const d = designRef.current;
      guides.current = d && !e.e.altKey ? snapMoving(c, e.target, d.width, d.height) : [];
    });
    c.on("mouse:up", () => {
      if (!guides.current.length) return;
      guides.current = [];
      c.requestRenderAll();
    });
    c.on("after:render", ({ ctx }) => {
      const d = designRef.current;
      if (d && ctx === c.getContext()) drawGuides(ctx, c, guides.current, d.width, d.height);
    });
    c.on("mouse:dblclick", (e) => {
      if (e.target instanceof FabricImage) startCropRef.current(e.target);
    });
    return () => {
      fc.current = null;
      void c.dispose().then(() => el.remove());
    };
  }, []);

  // Fit the page to the stage.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !design) return;
    const ro = new ResizeObserver(() => {
      const fit = Math.max(0.05, Math.min((stage.clientWidth - 64) / design.width, (stage.clientHeight - 64) / design.height));
      setFitZoom(fit);
      if (autoFit) setZoom(fit);
    });
    ro.observe(stage);
    return () => ro.disconnect();
  }, [design?.width, design?.height, autoFit]);

  useEffect(() => {
    const c = fc.current;
    if (!c || !design) return;
    c.setDimensions({ width: Math.round(design.width * zoom), height: Math.round(design.height * zoom) });
    c.setZoom(zoom);
    c.requestRenderAll();
  }, [zoom, design?.width, design?.height]);

  // ---------------- Designs ----------------
  const openDesign = async (id: string) => {
    if (crop) return toast.message("Finish or cancel the crop first");
    if (snapTimer.current) snapshot();
    await flushSave();
    const res = await fetch(`/api/design-studio/designs/${id}`);
    if (!res.ok) return toast.error("Could not open design");
    const { design: full } = (await res.json()) as { design: Design };
    const { doc, ...summary } = full;
    const loaded = pagesFromDoc(doc).map((p) => newPage(JSON.stringify(p)));
    pages.current = loaded.length ? loaded : [newPage()];
    hist.current = pages.current[0].hist;
    designRef.current = summary;
    setDesign(summary);
    setPage(0);
    setAutoFit(true);
    await loadJson(pages.current[0].json);
    setSaveState("saved");
    bump();
    // Thumbnails render in the background; the editor is usable straight away.
    const opened = pages.current;
    for (const p of opened) {
      p.thumb = await renderPage(p.json, summary.width, summary.height, { format: "jpeg", quality: 0.7, multiplier: THUMB_W / summary.width });
      if (pages.current !== opened) return;
      bump();
    }
  };

  const createDesign = async (preset: { label?: string; width: number; height: number }) => {
    const res = await fetch("/api/design-studio/designs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: preset.label ? `Untitled ${preset.label.toLowerCase()}` : undefined, width: preset.width, height: preset.height }),
    });
    if (!res.ok) return toast.error("Could not create design");
    const { design: created } = (await res.json()) as { design: Design };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { doc: _doc, ...summary } = created;
    setDesigns((list) => [summary, ...list]);
    await openDesign(created.id);
  };

  const removeDesign = async () => {
    if (!design) return;
    pendingSave.current = null;
    const res = await fetch(`/api/design-studio/designs/${design.id}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Could not delete design");
    const rest = designs.filter((d) => d.id !== design.id);
    setDesigns(rest);
    toast.success(`Deleted ${design.name}`);
    if (rest[0]) await openDesign(rest[0].id);
    else await createDesign(SIZE_PRESETS[0]);
  };

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/design-studio/designs");
      const { items } = (await res.json()) as { items: DesignSummary[] };
      setDesigns(items);
      if (items[0]) await openDesign(items[0].id);
      else await createDesign(SIZE_PRESETS[0]);
    })();
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSave.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      void flushSave();
    };
  }, []);

  // ---------------- Editing actions ----------------
  const addObject = (o: FabricObject) => {
    const c = fc.current;
    if (!c || !design) return;
    o.set({ left: design.width / 2, top: design.height / 2 });
    c.add(o);
    c.setActiveObject(o);
    c.requestRenderAll();
  };

  const unit = design ? Math.min(design.width, design.height) : 1000;

  const addShape = (kind: string) => {
    const s = unit * 0.3;
    const base = { fill: "#6366f1" };
    const shapes: Record<string, () => FabricObject> = {
      square: () => new Rect({ ...base, width: s, height: s }),
      rounded: () => new Rect({ ...base, width: s, height: s, rx: s * 0.15, ry: s * 0.15 }),
      circle: () => new Circle({ ...base, radius: s / 2 }),
      triangle: () => new Triangle({ ...base, width: s, height: s }),
      star: () => new Polygon(starPoints(s / 2, s / 4.5), base),
      line: () => new Line([0, 0, s * 1.5, 0], { stroke: "#111827", strokeWidth: Math.max(2, unit * 0.006) }),
    };
    addObject(shapes[kind]());
  };

  const addText = async (kind: "heading" | "subheading" | "body") => {
    await ensureFonts(["Inter"]);
    const size = { heading: 0.09, subheading: 0.055, body: 0.032 }[kind];
    const label = { heading: "Add a heading", subheading: "Add a subheading", body: "Add a little bit of body text" }[kind];
    addObject(
      new Textbox(label, {
        width: (design?.width ?? 1000) * 0.7,
        fontSize: Math.round(unit * size),
        fontWeight: kind === "body" ? "normal" : "bold",
        fontFamily: "Inter",
        fill: "#111827",
        textAlign: "center",
      }),
    );
  };

  const addImage = async (url: string) => {
    if (!design) return;
    const img = await FabricImage.fromURL(url);
    img.scale(Math.min(1, (design.width * 0.6) / img.width, (design.height * 0.6) / img.height));
    addObject(img);
  };

  const handleFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error(`${file.name} is over 15 MB`);
        continue;
      }
      const url = await readAsDataUrl(file);
      setUploads((list) => [url, ...list]);
      await addImage(url);
    }
  };

  const applyTemplate = async (t: Template) => {
    const c = fc.current;
    if (!c || !design || crop) return;
    await ensureFonts(t.fonts);
    muted.current = true;
    c.discardActiveObject();
    c.remove(...c.getObjects());
    c.backgroundColor = t.bg;
    c.add(...t.build(design.width, design.height));
    muted.current = false;
    c.requestRenderAll();
    snapshot();
  };

  const setProps = (props: Record<string, unknown>) => {
    const c = fc.current;
    if (!c) return;
    for (const o of c.getActiveObjects()) {
      o.set(props);
      o.setCoords();
    }
    c.getActiveObject()?.setCoords();
    c.requestRenderAll();
    queueSnap();
    bump();
  };

  const setBackground = (color: string) => {
    const c = fc.current;
    if (!c) return;
    c.backgroundColor = color;
    c.requestRenderAll();
    queueSnap();
    bump();
  };

  const removeSelected = () => {
    const c = fc.current;
    if (!c) return;
    const objs = c.getActiveObjects();
    if (!objs.length) return;
    c.discardActiveObject();
    c.remove(...objs);
    c.requestRenderAll();
  };

  const pasteClone = async (source: FabricObject | null) => {
    const c = fc.current;
    if (!c || !source) return;
    const cloned = await source.clone(EXTRA_PROPS);
    const offset = unit * 0.03;
    c.discardActiveObject();
    cloned.set({ left: cloned.left + offset, top: cloned.top + offset, evented: true });
    if (cloned instanceof ActiveSelection) {
      cloned.canvas = c;
      cloned.forEachObject((o) => c.add(o));
      cloned.setCoords();
    } else {
      c.add(cloned);
    }
    c.setActiveObject(cloned);
    c.requestRenderAll();
    // The next paste lands one step further.
    clipboard.current = cloned;
  };

  const duplicate = () => void pasteClone(fc.current?.getActiveObject() ?? null);

  const reorder = (how: "forward" | "backward" | "front" | "back") => {
    const c = fc.current;
    const o = c?.getActiveObject();
    if (!c || !o) return;
    if (how === "forward") c.bringObjectForward(o);
    if (how === "backward") c.sendObjectBackwards(o);
    if (how === "front") c.bringObjectToFront(o);
    if (how === "back") c.sendObjectToBack(o);
    c.requestRenderAll();
    queueSnap();
    bump();
  };

  // Layers list is top-first, so display row j is fabric index (n - 1 - j).
  const dropLayer = (row: number) => {
    const c = fc.current;
    if (c && dragLayer) {
      c.moveObjectTo(dragLayer, c.getObjects().length - 1 - row);
      c.requestRenderAll();
      queueSnap();
    }
    setDragLayer(null);
    setDropAt(null);
    bump();
  };

  const alignToPage = (where: "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom") => {
    const c = fc.current;
    const o = c?.getActiveObject();
    if (!c || !o || !design) return;
    const r = o.getBoundingRect();
    let dx = 0;
    let dy = 0;
    if (where === "left") dx = -r.left;
    if (where === "hcenter") dx = design.width / 2 - (r.left + r.width / 2);
    if (where === "right") dx = design.width - (r.left + r.width);
    if (where === "top") dy = -r.top;
    if (where === "vcenter") dy = design.height / 2 - (r.top + r.height / 2);
    if (where === "bottom") dy = design.height - (r.top + r.height);
    o.set({ left: o.left + dx, top: o.top + dy });
    o.setCoords();
    c.requestRenderAll();
    queueSnap();
  };

  const toggleLock = () => {
    const o = fc.current?.getActiveObject();
    if (!o) return;
    const locked = !o.lockMovementX;
    setProps({
      lockMovementX: locked,
      lockMovementY: locked,
      lockScalingX: locked,
      lockScalingY: locked,
      lockRotation: locked,
      hasControls: !locked,
    });
  };

  const group = () => {
    const c = fc.current;
    const active = c?.getActiveObject();
    if (!c || !(active instanceof ActiveSelection)) return;
    const objs = active.removeAll();
    c.discardActiveObject();
    muted.current = true;
    c.remove(...objs);
    const g = new Group(objs);
    c.add(g);
    muted.current = false;
    c.setActiveObject(g);
    c.requestRenderAll();
    snapshot();
  };

  const ungroup = () => {
    const c = fc.current;
    const active = c?.getActiveObject();
    if (!c || !(active instanceof Group) || active instanceof ActiveSelection) return;
    muted.current = true;
    const objs = active.removeAll();
    c.remove(active);
    c.add(...objs);
    muted.current = false;
    c.setActiveObject(new ActiveSelection(objs, { canvas: c }));
    c.requestRenderAll();
    snapshot();
  };

  const fileBase = () => design?.name.replace(/[^\w\- ]+/g, "").trim() || "design";

  const exportImage = async (format: "png" | "jpeg") => {
    if (!design) return;
    if (snapTimer.current) snapshot();
    const url = await renderPage(pages.current[page].json, design.width, design.height, { format, multiplier: 1 });
    const suffix = pages.current.length > 1 ? `-page-${page + 1}` : "";
    download(url, `${fileBase()}${suffix}.${format === "jpeg" ? "jpg" : "png"}`);
  };

  // shortcut: pages are embedded as JPEG images, so PDF text is not selectable; render vector text if print matters.
  const exportPdf = async () => {
    if (!design || exporting) return;
    if (snapTimer.current) snapshot();
    setExporting(true);
    try {
      const { jsPDF } = await import("jspdf");
      const { width: w, height: h } = design;
      const orientation = w > h ? "landscape" : "portrait";
      const pdf = new jsPDF({ orientation, unit: "px", format: [w, h], hotfixes: ["px_scaling"] });
      for (const [i, p] of pages.current.entries()) {
        if (i > 0) pdf.addPage([w, h], orientation);
        pdf.addImage(await renderPage(p.json, w, h, { format: "jpeg", multiplier: 1 }), "JPEG", 0, 0, w, h);
      }
      pdf.save(`${fileBase()}.pdf`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  // ---------------- Crop ----------------
  // The crop box shares the image's transform; on apply its corners are mapped into the image's local plane.
  const startCrop = (img: FabricImage) => {
    const c = fc.current;
    if (!c || crop || img.lockMovementX) return;
    muted.current = true;
    const box = new Rect({
      width: img.width,
      height: img.height,
      scaleX: img.scaleX,
      scaleY: img.scaleY,
      angle: img.angle,
      fill: "rgba(255,255,255,0.12)",
      stroke: "#ec4899",
      strokeWidth: 2,
      strokeUniform: true,
      strokeDashArray: [8, 6],
      lockRotation: true,
      lockScalingFlip: true,
      objectCaching: false,
    });
    box.setControlVisible("mtr", false);
    box.setPositionByOrigin(img.getCenterPoint(), "center", "center");
    img.set({ selectable: false, evented: false });
    c.discardActiveObject();
    c.add(box);
    c.setActiveObject(box);
    c.requestRenderAll();
    setCrop({ img, box });
  };
  startCropRef.current = startCrop;

  const endCrop = (apply: boolean) => {
    const c = fc.current;
    if (!c || !crop) return;
    const { img, box } = crop;
    if (apply) {
      const inv = util.invertTransform(img.calcTransformMatrix());
      const local = box.getCoords().map((pt) => util.transformPoint(pt, inv));
      const xs = local.map((pt) => pt.x);
      const ys = local.map((pt) => pt.y);
      const next = cropFromLocalBox(
        { cropX: img.cropX, cropY: img.cropY, width: img.width, height: img.height },
        { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
      );
      const center = util.transformPoint({ x: next.cx, y: next.cy }, img.calcTransformMatrix());
      img.set({ cropX: next.cropX, cropY: next.cropY, width: next.width, height: next.height });
      img.setPositionByOrigin(center, "center", "center");
    }
    img.set({ selectable: true, evented: true });
    img.setCoords();
    c.remove(box);
    muted.current = false;
    setCrop(null);
    c.setActiveObject(img);
    c.requestRenderAll();
    if (apply) snapshot();
  };

  const resetCrop = () => {
    const o = fc.current?.getActiveObject();
    if (!(o instanceof FabricImage)) return;
    const el = o.getElement() as HTMLImageElement;
    const center = o.getCenterPoint();
    o.set({ cropX: 0, cropY: 0, width: el.naturalWidth || el.width, height: el.naturalHeight || el.height });
    o.setPositionByOrigin(center, "center", "center");
    o.setCoords();
    fc.current!.requestRenderAll();
    snapshot();
    bump();
  };

  // ---------------- Effects ----------------
  const setShadow = (next: { color: string; blur: number; offsetX: number; offsetY: number } | null) => {
    const c = fc.current;
    if (!c) return;
    for (const o of c.getActiveObjects()) o.set({ shadow: next ? new Shadow(next) : null });
    c.requestRenderAll();
    queueSnap();
    bump();
  };

  // ---------------- Keyboard ----------------
  const keyRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyRef.current = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    const c = fc.current;
    if (!c) return;
    // Crop mode is modal: only Enter/Escape, so Delete cannot remove the crop box.
    if (crop) {
      if (e.key === "Enter") endCrop(true);
      if (e.key === "Escape") endCrop(false);
      return;
    }
    const active = c.getActiveObject();
    if (active instanceof Textbox && active.isEditing) return;
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && k === "z") {
      e.preventDefault();
      void step(e.shiftKey ? 1 : -1);
    } else if (mod && k === "y") {
      e.preventDefault();
      void step(1);
    } else if (mod && k === "d") {
      e.preventDefault();
      duplicate();
    } else if (mod && k === "c" && active) {
      clipboard.current = active;
    } else if (mod && k === "v" && clipboard.current) {
      e.preventDefault();
      void pasteClone(clipboard.current);
    } else if (mod && k === "g") {
      e.preventDefault();
      if (e.shiftKey) ungroup();
      else group();
    } else if ((e.key === "Delete" || e.key === "Backspace") && active) {
      e.preventDefault();
      removeSelected();
    } else if (active && e.key.startsWith("Arrow")) {
      e.preventDefault();
      const d = e.shiftKey ? 10 : 1;
      const dx = e.key === "ArrowLeft" ? -d : e.key === "ArrowRight" ? d : 0;
      const dy = e.key === "ArrowUp" ? -d : e.key === "ArrowDown" ? d : 0;
      active.set({ left: active.left + dx, top: active.top + dy });
      active.setCoords();
      c.requestRenderAll();
      queueSnap();
    } else if (e.key === "Escape") {
      c.discardActiveObject();
      c.requestRenderAll();
    }
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---------------- Render ----------------
  const c = fc.current;
  const objs = sel ? (c?.getActiveObjects() ?? []) : [];
  const first = objs[0];
  const isText = !!first && objs.every((o) => o instanceof Textbox);
  const isLine = !!first && objs.every((o) => o instanceof Line);
  const isRect = !!first && objs.length === 1 && first instanceof Rect;
  const isImage = !!first && objs.every((o) => o instanceof FabricImage);
  const active = sel;
  const isSelection = active instanceof ActiveSelection;
  const isGroup = active instanceof Group && !isSelection;
  const text = isText ? (first as Textbox) : null;
  const canUndo = hist.current.i > 0;
  const canRedo = hist.current.i < hist.current.stack.length - 1;
  const bg = toHex(c?.backgroundColor);

  const panelTitle = "text-sm font-medium";
  const tile = "flex cursor-pointer items-center justify-center rounded-xl bg-raised transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

  const shadow = first?.shadow instanceof Shadow ? first.shadow : null;
  const shadowOpts = { color: shadow?.color ?? "#00000080", blur: shadow?.blur ?? Math.round(unit * 0.02), offsetX: shadow?.offsetX ?? Math.round(unit * 0.01), offsetY: shadow?.offsetY ?? Math.round(unit * 0.01) };
  const effectMax = Math.max(20, Math.round(unit * 0.1));
  const slider = (label: string, value: number, min: number, max: number, stepBy: number, onChange: (v: number) => void) => (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      <span className="flex justify-between">
        {label}
        <span className="num">{Math.round(value * 100) / 100}</span>
      </span>
      <input type="range" min={min} max={max} step={stepBy} value={value} onChange={(e) => onChange(Number(e.target.value))} className="cursor-pointer accent-white" />
    </label>
  );
  const effectSection = "flex flex-col gap-3 border-t border-border pt-4 first:border-t-0 first:pt-0";

  const panels: Record<Tab, React.ReactNode> = {
    effects: !first || isGroup || isSelection ? (
      <p className="text-sm text-faint">Select one element to add effects.</p>
    ) : (
      <div className="flex flex-col gap-4">
        <div className={effectSection}>
          <label className="flex items-center justify-between text-sm font-medium">
            Shadow
            <input type="checkbox" checked={!!shadow} onChange={(e) => setShadow(e.target.checked ? shadowOpts : null)} className="size-4 cursor-pointer accent-white" />
          </label>
          {shadow && (
            <>
              <label className="flex items-center justify-between text-xs text-muted-foreground">
                Color
                <input type="color" value={toHex(shadow.color)} onChange={(e) => setShadow({ ...shadowOpts, color: e.target.value + "99" })} className="h-7 w-12 cursor-pointer rounded bg-transparent" />
              </label>
              {slider("Blur", shadowOpts.blur, 0, effectMax, 1, (v) => setShadow({ ...shadowOpts, blur: v }))}
              {slider("Offset X", shadowOpts.offsetX, -effectMax, effectMax, 1, (v) => setShadow({ ...shadowOpts, offsetX: v }))}
              {slider("Offset Y", shadowOpts.offsetY, -effectMax, effectMax, 1, (v) => setShadow({ ...shadowOpts, offsetY: v }))}
            </>
          )}
        </div>
        {text && (
          <>
            <div className={effectSection}>
              <label className="flex items-center justify-between text-sm font-medium">
                Outline
                <input
                  type="checkbox"
                  checked={!!text.stroke && text.strokeWidth > 0}
                  onChange={(e) =>
                    setProps(e.target.checked
                      ? { stroke: "#000000", strokeWidth: Math.max(1, Math.round(text.fontSize * 0.06)), paintFirst: "stroke", strokeUniform: true }
                      : { stroke: null, strokeWidth: 0 })
                  }
                  className="size-4 cursor-pointer accent-white"
                />
              </label>
              {!!text.stroke && text.strokeWidth > 0 && (
                <>
                  <label className="flex items-center justify-between text-xs text-muted-foreground">
                    Color
                    <input type="color" value={toHex(text.stroke)} onChange={(e) => setProps({ stroke: e.target.value })} className="h-7 w-12 cursor-pointer rounded bg-transparent" />
                  </label>
                  {slider("Thickness", text.strokeWidth, 1, Math.max(4, Math.round(text.fontSize * 0.25)), 1, (v) => setProps({ strokeWidth: v }))}
                </>
              )}
            </div>
            <div className={effectSection}>
              <h3 className="text-sm font-medium">Spacing</h3>
              {slider("Letter spacing", text.charSpacing, -100, 800, 10, (v) => setProps({ charSpacing: v }))}
              {slider("Line height", text.lineHeight, 0.6, 3, 0.05, (v) => setProps({ lineHeight: v }))}
            </div>
            <div className={effectSection}>
              <h3 className="text-sm font-medium">Highlight</h3>
              <div className="flex items-center justify-between gap-2">
                <input type="color" aria-label="Highlight color" value={toHex(text.textBackgroundColor || "#fef08a")} onChange={(e) => setProps({ textBackgroundColor: e.target.value })} className="h-7 w-12 cursor-pointer rounded bg-transparent" />
                <Button variant="ghost" size="xs" onClick={() => setProps({ textBackgroundColor: "" })} disabled={!text.textBackgroundColor}>
                  Remove
                </Button>
              </div>
            </div>
          </>
        )}
        {isImage && (
          <div className={effectSection}>
            <h3 className="text-sm font-medium">Crop</h3>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => startCrop(first as FabricImage)}>
                <CropIcon data-icon="inline-start" /> Crop
              </Button>
              <Button variant="ghost" size="sm" onClick={resetCrop}>
                <RotateCcw data-icon="inline-start" /> Reset
              </Button>
            </div>
          </div>
        )}
      </div>
    ),
    templates: (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <h2 className={panelTitle}>Templates</h2>
          <div className="grid grid-cols-2 gap-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() => void applyTemplate(t)}
                className={cn(tile, "aspect-square flex-col gap-1 text-xs font-medium")}
                style={{ background: t.bg, color: t.bg === "#111827" || t.bg === "#ef4444" ? "#fff" : "#111" }}
                title="Replaces the page content"
              >
                {t.name}
              </button>
            ))}
          </div>
          <p className="text-xs text-faint">A template replaces the page content. Undo brings it back.</p>
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <h2 className={panelTitle}>Resize page</h2>
          <ul className="flex flex-col gap-1">
            {SIZE_PRESETS.map((p) => {
              const current = design?.width === p.width && design?.height === p.height;
              return (
                <li key={p.label}>
                  <button
                    type="button"
                    onClick={() => void patchMeta({ width: p.width, height: p.height })}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent",
                      current && "bg-raised",
                    )}
                  >
                    <span>{p.label}</span>
                    <span className="num text-xs text-faint">{p.width}×{p.height}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <form
            className="flex items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              void patchMeta({ width: Number(customW), height: Number(customH) });
            }}
          >
            <Input aria-label="Width" inputMode="numeric" value={customW} onChange={(e) => setCustomW(e.target.value)} className="num h-8" />
            <span className="text-faint">×</span>
            <Input aria-label="Height" inputMode="numeric" value={customH} onChange={(e) => setCustomH(e.target.value)} className="num h-8" />
            <Button type="submit" size="sm" variant="outline">Set</Button>
          </form>
        </div>
      </div>
    ),
    elements: (
      <div className="flex flex-col gap-2">
        <h2 className={panelTitle}>Shapes</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "square", svg: <rect x="4" y="4" width="16" height="16" /> },
            { id: "rounded", svg: <rect x="4" y="4" width="16" height="16" rx="4" /> },
            { id: "circle", svg: <circle cx="12" cy="12" r="8" /> },
            { id: "triangle", svg: <path d="M12 4 20 20H4Z" /> },
            { id: "star", svg: <path d="m12 3 2.6 5.8 6.4.6-4.8 4.3 1.4 6.3L12 16.8 6.4 20l1.4-6.3L3 9.4l6.4-.6Z" /> },
            { id: "line", svg: <path d="M4 12h16" stroke="currentColor" strokeWidth="2" /> },
          ].map((s) => (
            <button key={s.id} type="button" onClick={() => addShape(s.id)} className={cn(tile, "aspect-square")} aria-label={`Add ${s.id}`} title={s.id}>
              <svg viewBox="0 0 24 24" className="size-9 fill-current text-foreground">{s.svg}</svg>
            </button>
          ))}
        </div>
      </div>
    ),
    text: (
      <div className="flex flex-col gap-2">
        <h2 className={panelTitle}>Add text</h2>
        <button type="button" onClick={() => void addText("heading")} className={cn(tile, "justify-start px-3 py-3 text-xl font-bold")}>Add a heading</button>
        <button type="button" onClick={() => void addText("subheading")} className={cn(tile, "justify-start px-3 py-2.5 text-base font-semibold")}>Add a subheading</button>
        <button type="button" onClick={() => void addText("body")} className={cn(tile, "justify-start px-3 py-2 text-sm")}>Add a little bit of body text</button>
        <p className="pt-1 text-xs text-faint">Double-click text on the page to edit it.</p>
      </div>
    ),
    uploads: (
      <div className="flex flex-col gap-3">
        <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
          <Upload data-icon="inline-start" /> Upload images
        </Button>
        <p className="text-xs text-faint">Or drop images onto the page. Images are stored inside the design file.</p>
        {uploads.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {uploads.map((u, i) => (
              <button key={i} type="button" onClick={() => void addImage(u)} className={cn(tile, "aspect-square overflow-hidden p-1")} aria-label="Add image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={u} alt="" className="size-full rounded-lg object-contain" />
              </button>
            ))}
          </div>
        )}
      </div>
    ),
    background: (
      <div className="flex flex-col gap-3">
        <h2 className={panelTitle}>Page color</h2>
        <div className="grid grid-cols-6 gap-2">
          {SWATCHES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setBackground(s)}
              className={cn("aspect-square cursor-pointer rounded-lg border border-border", bg === s && "ring-2 ring-ring")}
              style={{ background: s }}
              aria-label={`Background ${s}`}
            />
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          Custom
          <input type="color" value={bg} onChange={(e) => setBackground(e.target.value)} className="h-8 w-14 cursor-pointer rounded bg-transparent" />
        </label>
      </div>
    ),
    layers: (
      <div className="flex flex-col gap-2">
        <h2 className={panelTitle}>Layers</h2>
        {!c || c.getObjects().length === 0 ? (
          <p className="text-sm text-faint">Nothing on the page yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {[...c.getObjects()].reverse().map((o, i) => {
              const selected = objs.includes(o);
              return (
                <li
                  key={i}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                    setDragLayer(o);
                  }}
                  onDragOver={(e) => {
                    if (!dragLayer) return;
                    e.preventDefault();
                    setDropAt(i);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    dropLayer(i);
                  }}
                  onDragEnd={() => {
                    setDragLayer(null);
                    setDropAt(null);
                  }}
                  className={cn(
                    "flex cursor-grab items-center gap-1 rounded-lg pr-1 active:cursor-grabbing",
                    selected ? "bg-raised" : "hover:bg-accent",
                    dragLayer === o && "opacity-40",
                    dragLayer && dragLayer !== o && dropAt === i && "ring-2 ring-ring",
                  )}
                >
                  <GripVertical className="ml-1 size-3.5 shrink-0 text-faint" aria-hidden />
                  <button
                    type="button"
                    className="min-w-0 flex-1 cursor-pointer truncate py-2 pr-1 pl-1.5 text-left text-sm"
                    onClick={() => {
                      c.setActiveObject(o);
                      c.requestRenderAll();
                    }}
                  >
                    {layerLabel(o)}
                  </button>
                  {o.lockMovementX && <Lock className="size-3.5 text-faint" aria-label="Locked" />}
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={o.visible ? "Hide layer" : "Show layer"}
                    onClick={() => {
                      o.set({ visible: !o.visible });
                      c.requestRenderAll();
                      queueSnap();
                      bump();
                    }}
                  >
                    {o.visible ? <Eye /> : <EyeOff />}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    ),
  };

  const sep = <span className="mx-1 h-5 w-px shrink-0 bg-border" aria-hidden />;
  const colorInput = (label: string, value: string, onChange: (v: string) => void) => (
    <label className="relative flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full hover:bg-accent" title={label}>
      <span className="size-5 rounded-full border border-border" style={{ background: value }} />
      <input type="color" aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
    </label>
  );

  return (
    <>
      <AppTopbar title="Design studio" icon={Paintbrush}>
        <span className="hidden text-xs text-muted-foreground xl:inline">
          {saveState === "saving" ? "Saving" : saveState === "unsaved" ? "Unsaved" : design ? "Saved" : null}
        </span>
        <Button variant="ghost" size="icon-sm" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={() => void step(-1)}>
          <Undo2 />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={() => void step(1)}>
          <Redo2 />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" className="max-w-[6rem] min-w-0 text-white sm:max-w-[14rem]" />}>
            <span className="truncate">{design?.name ?? "Loading"}</span>
            <ChevronsUpDown data-icon="inline-end" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Designs</DropdownMenuLabel>
              {designs.map((d) => (
                <DropdownMenuItem key={d.id} onClick={() => void openDesign(d.id)} className="py-2">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{d.name}</span>
                    <span className="num truncate text-xs text-faint">{d.width}×{d.height}</span>
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>New design</DropdownMenuLabel>
              {SIZE_PRESETS.map((p) => (
                <DropdownMenuItem key={p.label} onClick={() => void createDesign(p)}>
                  <Plus /> {p.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)} disabled={!design}>
              <Trash2 /> Delete this design
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button disabled={!design || exporting} />}>
            <Download data-icon="inline-start" /> {exporting ? "Exporting" : "Download"}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel>{pages.current.length > 1 ? `Page ${page + 1}` : "Image"}</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => void exportImage("png")}>PNG</DropdownMenuItem>
              <DropdownMenuItem onClick={() => void exportImage("jpeg")}>JPG</DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void exportPdf()} disabled={exporting}>
              PDF{pages.current.length > 1 ? ` (all ${pages.current.length} pages)` : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </AppTopbar>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-label="Upload images"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
          e.currentTarget.value = "";
        }}
      />

      <div className="flex h-[calc(100svh-4rem)] min-h-0 gap-3.5 px-4 pt-4 pb-4 md:px-7">
        <h1 className="sr-only">Design studio{design ? `, ${design.name}` : ""}</h1>

        {/* Tool rail + drawer */}
        <nav aria-label="Design tools" className="flex w-16 shrink-0 flex-col gap-1 rounded-[20px] bg-card p-1.5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(active ? null : t.id)}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1 rounded-xl py-2 text-[10px] transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  active ? "bg-raised text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <Icon className="size-5" />
                {t.label}
              </button>
            );
          })}
        </nav>
        {tab && (
          <aside className="w-56 shrink-0 overflow-y-auto rounded-[20px] bg-card p-4 lg:w-64">
            {panels[tab]}
          </aside>
        )}

        <section className="flex min-h-0 min-w-0 flex-1 flex-col gap-2.5 rounded-[20px] bg-card p-2.5">
          {/* Contextual toolbar */}
          <div className="flex min-h-10 shrink-0 flex-wrap items-center gap-0.5 px-1">
            {crop ? (
              <>
                <span className="px-2 text-sm text-muted-foreground">Drag the pink box to crop. Enter applies, Esc cancels.</span>
                <span className="ml-auto" />
                <Button variant="ghost" size="sm" onClick={() => endCrop(false)}>
                  <X data-icon="inline-start" /> Cancel
                </Button>
                <Button size="sm" onClick={() => endCrop(true)}>
                  <Check data-icon="inline-start" /> Done
                </Button>
              </>
            ) : !first ? (
              <span className="px-2 text-sm text-faint">Select an element to edit it. Dragged elements snap to the page and each other; hold Alt to move freely.</span>
            ) : (
              <>
                {text && (
                  <>
                    <select
                      aria-label="Font"
                      value={text.fontFamily}
                      onChange={(e) => {
                        const family = e.target.value;
                        void ensureFonts([family]).then(() => setProps({ fontFamily: family }));
                      }}
                      className="h-8 max-w-40 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm [color-scheme:dark] [&_option]:bg-popover [&_option]:text-popover-foreground"
                    >
                      <optgroup label="Google fonts">
                        {WEB_FONTS.map((f) => (
                          <option key={f} value={f} style={{ fontFamily: `"${f}"` }}>{f}</option>
                        ))}
                      </optgroup>
                      <optgroup label="System">
                        {SYSTEM_FONTS.map((f) => (
                          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
                        ))}
                      </optgroup>
                    </select>
                    <Input
                      key={`fs-${text.fontSize}`}
                      aria-label="Font size"
                      inputMode="numeric"
                      defaultValue={Math.round(text.fontSize)}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (n > 0) setProps({ fontSize: n });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="num ml-1 h-8 w-16 shrink-0"
                    />
                    {colorInput("Text color", toHex(text.fill), (v) => setProps({ fill: v }))}
                    <Button variant="ghost" size="icon-sm" aria-label="Bold" aria-pressed={text.fontWeight === "bold"} className={cn(text.fontWeight === "bold" && "bg-accent text-foreground")} onClick={() => setProps({ fontWeight: text.fontWeight === "bold" ? "normal" : "bold" })}>
                      <Bold />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Italic" aria-pressed={text.fontStyle === "italic"} className={cn(text.fontStyle === "italic" && "bg-accent text-foreground")} onClick={() => setProps({ fontStyle: text.fontStyle === "italic" ? "normal" : "italic" })}>
                      <Italic />
                    </Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Underline" aria-pressed={!!text.underline} className={cn(text.underline && "bg-accent text-foreground")} onClick={() => setProps({ underline: !text.underline })}>
                      <Underline />
                    </Button>
                    <select
                      aria-label="Text align"
                      value={text.textAlign}
                      onChange={(e) => setProps({ textAlign: e.target.value })}
                      className="h-8 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent px-2 text-sm [color-scheme:dark] [&>option]:bg-popover [&>option]:text-popover-foreground"
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                      <option value="justify">Justify</option>
                    </select>
                    {sep}
                  </>
                )}
                {!text && !isImage && !isLine && !objs.some((o) => o instanceof Group) && (
                  <>
                    {colorInput("Fill color", toHex(first.fill), (v) => setProps({ fill: v }))}
                    {colorInput("Border color", toHex(first.stroke ?? "#000000"), (v) => setProps({ stroke: v, strokeWidth: first.strokeWidth || Math.max(2, unit * 0.005) }))}
                    <Input
                      key={`sw-${first.strokeWidth}`}
                      aria-label="Border width"
                      title="Border width"
                      inputMode="numeric"
                      defaultValue={first.stroke ? first.strokeWidth : 0}
                      onBlur={(e) => {
                        const n = Math.max(0, Number(e.target.value) || 0);
                        setProps({ strokeWidth: n, stroke: n ? (first.stroke ?? "#000000") : null });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="num h-8 w-14 shrink-0"
                    />
                    {isRect && (
                      <Input
                        key={`rx-${(first as Rect).rx}`}
                        aria-label="Corner radius"
                        title="Corner radius"
                        inputMode="numeric"
                        defaultValue={Math.round((first as Rect).rx)}
                        onBlur={(e) => {
                          const n = Math.max(0, Number(e.target.value) || 0);
                          setProps({ rx: n, ry: n });
                        }}
                        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        className="num ml-1 h-8 w-14 shrink-0"
                      />
                    )}
                    {sep}
                  </>
                )}
                {isLine && (
                  <>
                    {colorInput("Line color", toHex(first.stroke), (v) => setProps({ stroke: v }))}
                    <Input
                      key={`lw-${first.strokeWidth}`}
                      aria-label="Line width"
                      inputMode="numeric"
                      defaultValue={first.strokeWidth}
                      onBlur={(e) => {
                        const n = Number(e.target.value);
                        if (n > 0) setProps({ strokeWidth: n });
                      }}
                      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                      className="num h-8 w-14 shrink-0"
                    />
                    {sep}
                  </>
                )}
                <label className="flex shrink-0 items-center gap-1.5 px-1 text-xs text-muted-foreground" title="Transparency">
                  Opacity
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.round(first.opacity * 100)}
                    onChange={(e) => setProps({ opacity: Number(e.target.value) / 100 })}
                    className="w-20 cursor-pointer accent-white"
                  />
                </label>
                {sep}
                <Button variant="ghost" size="icon-sm" aria-label="Flip horizontal" title="Flip horizontal" onClick={() => setProps({ flipX: !first.flipX })}>
                  <FlipHorizontal2 />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Flip vertical" title="Flip vertical" onClick={() => setProps({ flipY: !first.flipY })}>
                  <FlipVertical2 />
                </Button>
                {isImage && objs.length === 1 && (
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={() => startCrop(first as FabricImage)} title="Crop (double-click the image)">
                    <CropIcon data-icon="inline-start" /> Crop
                  </Button>
                )}
                {!isGroup && !isSelection && (
                  <Button variant="ghost" size="sm" className={cn("shrink-0", tab === "effects" && "bg-accent text-foreground")} onClick={() => setTab(tab === "effects" ? null : "effects")}>
                    <Sparkles data-icon="inline-start" /> Effects
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger render={<Button variant="ghost" size="sm" className="shrink-0" />}>
                    Position <ChevronDown data-icon="inline-end" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Arrange</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => reorder("forward")}><ChevronUp /> Forward</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => reorder("backward")}><ChevronDown /> Backward</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => reorder("front")}><ArrowUpToLine /> To front</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => reorder("back")}><ArrowDownToLine /> To back</DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Align to page</DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => alignToPage("left")}><AlignStartVertical /> Left</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alignToPage("hcenter")}><AlignCenterVertical /> Center</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alignToPage("right")}><AlignEndVertical /> Right</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alignToPage("top")}><AlignStartHorizontal /> Top</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alignToPage("vcenter")}><AlignCenterHorizontal /> Middle</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => alignToPage("bottom")}><AlignEndHorizontal /> Bottom</DropdownMenuItem>
                    </DropdownMenuGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isSelection && (
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={group} title="Group (Ctrl+G)">
                    <GroupIcon data-icon="inline-start" /> Group
                  </Button>
                )}
                {isGroup && (
                  <Button variant="ghost" size="sm" className="shrink-0" onClick={ungroup} title="Ungroup (Ctrl+Shift+G)">
                    <Ungroup data-icon="inline-start" /> Ungroup
                  </Button>
                )}
                <span className="ml-auto" />
                <Button variant="ghost" size="icon-sm" aria-label={first.lockMovementX ? "Unlock" : "Lock"} title={first.lockMovementX ? "Unlock" : "Lock"} className={cn(first.lockMovementX && "bg-accent text-foreground")} onClick={toggleLock}>
                  <Lock />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Duplicate" title="Duplicate (Ctrl+D)" onClick={duplicate}>
                  <Copy />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete" title="Delete" onClick={removeSelected}>
                  <Trash2 />
                </Button>
              </>
            )}
          </div>

          {/* Stage */}
          <div
            ref={stageRef}
            className="relative flex min-h-0 flex-1 overflow-auto rounded-2xl bg-black"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files.length) void handleFiles(e.dataTransfer.files);
            }}
            onMouseDown={(e) => {
              // Clicking the grey area around the page clears the selection, like clicking empty page space.
              if (e.target === e.currentTarget && fc.current) {
                fc.current.discardActiveObject();
                fc.current.requestRenderAll();
              }
            }}
          >
            <div ref={hostRef} className="m-auto shrink-0 p-8 [&_.canvas-container]:shadow-2xl" />
          </div>

          {/* Pages + zoom */}
          <div className="flex shrink-0 flex-wrap items-center gap-1 px-1 text-xs text-muted-foreground">
            <ol aria-label="Pages" className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1">
              {pages.current.map((p, i) => (
                <li
                  key={p.id}
                  draggable={!crop}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("text/plain", String(i));
                    setDragPage(i);
                  }}
                  onDragOver={(e) => dragPage !== null && e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragPage !== null) movePage(dragPage, i);
                    setDragPage(null);
                  }}
                  onDragEnd={() => setDragPage(null)}
                  className={cn("shrink-0", dragPage === i && "opacity-40")}
                >
                  <button
                    type="button"
                    onClick={() => void goToPage(i)}
                    aria-current={i === page ? "page" : undefined}
                    aria-label={`Page ${i + 1}`}
                    className={cn(
                      "relative block h-12 cursor-pointer overflow-hidden rounded-md bg-white ring-offset-2 ring-offset-card transition-shadow",
                      i === page ? "ring-2 ring-white" : "ring-1 ring-border hover:ring-muted-foreground",
                    )}
                    style={{ aspectRatio: design ? `${design.width} / ${design.height}` : "1" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {p.thumb && <img src={p.thumb} alt="" className="size-full object-cover" />}
                    <span className="num absolute bottom-0.5 left-1 rounded bg-black/60 px-1 text-[10px] text-white">{i + 1}</span>
                  </button>
                </li>
              ))}
              <li className="flex shrink-0 gap-0.5">
                <Button variant="ghost" size="icon-sm" aria-label="Add page" title="Add page" disabled={!!crop} onClick={() => void insertPage()}>
                  <Plus />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Duplicate page" title="Duplicate page" disabled={!!crop} onClick={() => void insertPage(pages.current[page]?.json)}>
                  <CopyPlus />
                </Button>
                <Button variant="ghost" size="icon-sm" aria-label="Delete page" title="Delete page" disabled={!!crop || pages.current.length < 2} onClick={() => setDeletePageOpen(true)}>
                  <Trash2 />
                </Button>
              </li>
            </ol>
            <Button variant="ghost" size="icon-xs" aria-label="Zoom out" onClick={() => { setAutoFit(false); setZoom((z) => Math.max(0.05, z / 1.2)); }}>
              <Minus />
            </Button>
            <span className="num w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="ghost" size="icon-xs" aria-label="Zoom in" onClick={() => { setAutoFit(false); setZoom((z) => Math.min(4, z * 1.2)); }}>
              <Plus />
            </Button>
            <Button variant="ghost" size="xs" onClick={() => { setAutoFit(true); setZoom(fitZoom); }}>
              <Maximize data-icon="inline-start" /> Fit
            </Button>
            {design && (
              <Input
                key={design.id + design.name}
                aria-label="Design name"
                defaultValue={design.name}
                onBlur={(e) => e.target.value.trim() !== design.name && void patchMeta({ name: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                className="ml-2 h-7 w-44 text-xs"
              />
            )}
          </div>
        </section>
      </div>

      <AlertDialog open={deletePageOpen} onOpenChange={setDeletePageOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete page {page + 1}?</AlertDialogTitle>
            <AlertDialogDescription>Everything on this page is removed. Undo cannot bring a deleted page back.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void deletePage()}>
              Delete page
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{design?.name ?? ""}”?</AlertDialogTitle>
            <AlertDialogDescription>The design file is removed from disk. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void removeDesign()}>
              Delete design
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
