"use client";

import { SHOW_GET_THIS_LOOK } from "@/lib/feature-flags";
import Image from "next/image";
import { trackEvent, trackEventOnce } from "@/lib/analytics";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { curatedLooks, heroPortrait, type CuratedLook } from "@/app/data/lumora-data";
import { clearStoredJobId, createJobId, readStoredJobId, storeJobId, waitForPoll } from "@/lib/generation-job-client";
import { createStoryFile } from "@/lib/story-image";
import { SiteFooter } from "./site-footer";
import type { LookAnalysis, LookAnalysisCategories, LookAnalysisInput, LookCategory } from "@/lib/look-analysis";
import type { LookGenerationResult } from "@/lib/look-generation";

type Screen = "landing" | "face" | "inspiration" | "confirmation" | "generating" | "result" | "share" | "shop";
type LocalImage = { src: string; name: string };
type RequirementSlot = { key: LookCategory; label: string };
type RequirementGroup = { id: string; title: string; subtitle: string; slots: RequirementSlot[] };
const generationLines = ["Reading your inspiration…", "Matching the makeup…", "Keeping you, you…", "Creating your Lumora…"];
const requirementGroups: RequirementGroup[] = [
  { id: "eyes", title: "Eyes", subtitle: "Eye colour and lash definition from this Lumora.", slots: [{ key: "eyeshadow", label: "Eyeshadow" }, { key: "linerMascara", label: "Liner & mascara" }] },
  { id: "complexion", title: "Brows & complexion", subtitle: "Brow and cheek requirements from this Lumora.", slots: [{ key: "brows", label: "Brows" }, { key: "blush", label: "Blush" }] },
  { id: "lips", title: "Lip colour", subtitle: "Lip colour requirements from this Lumora.", slots: [{ key: "lipColour", label: "Lip colour" }] },
];
type IconName = "arrow-left" | "arrow-right" | "check" | "download" | "heart" | "plus" | "refresh" | "share" | "sparkle";

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return <svg className={`lumora-icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {name === "arrow-left" && <><path d="M20 12H4" /><path d="m11 5-7 7 7 7" /></>}
    {name === "arrow-right" && <><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></>}
    {name === "check" && <path d="m5 12 4 4L19 6" />}
    {name === "download" && <><path d="M12 3v12" /><path d="m7 10 5 5 5-5" /><path d="M5 20h14" /></>}
    {name === "heart" && <path d="M20.8 8.8c0 5-8.8 10.2-8.8 10.2S3.2 13.8 3.2 8.8A4.5 4.5 0 0 1 12 6.2a4.5 4.5 0 0 1 8.8 2.6Z" />}
    {name === "plus" && <><path d="M12 5v14" /><path d="M5 12h14" /></>}
    {name === "refresh" && <><path d="M20 7v5h-5" /><path d="M19 12a7 7 0 0 0-12-4L4 11" /><path d="M4 17v-5h5" /><path d="M5 12a7 7 0 0 0 12 4l3-3" /></>}
    {name === "share" && <><circle cx="18" cy="5" r="2.5" /><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="19" r="2.5" /><path d="m8.3 10.8 7.4-4.5M8.3 13.2l7.4 4.5" /></>}
    {name === "sparkle" && <><path d="m12 3 1.8 6.2L20 11l-6.2 1.8L12 19l-1.8-6.2L4 11l6.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>}
  </svg>;
}

async function imageAsDataUrl(source: string): Promise<string> {
  const response = await fetch(source);
  if (!response.ok) throw new Error("An image could not be loaded.");
  const sourceBlob = await response.blob();
  const bitmap = await createImageBitmap(sourceBlob);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("An image could not be prepared.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const compressed = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("An image could not be compressed.")), "image/jpeg", 0.82);
  });
  const bytes = new Uint8Array(await compressed.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

async function analysisSafeImage(source: string): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(source)).blob());
  try {
    for (const maxEdge of [1536, 1280, 1024, 768]) {
      const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext("2d");
      if (!context) break;
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.85, 0.75, 0.65]) {
        const dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (dataUrl.length <= 4_000_000) return dataUrl;
      }
    }
  } finally { bitmap.close(); }
  throw new Error("The Lumora could not be prepared for analysis.");
}

class NoUsableFaceError extends Error {}
class RateLimitError extends Error {}

class GenerationTimeout extends Error {
  constructor() { super("Lumora is taking longer than expected. Please try again."); }
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload !== "object" || payload === null || !("error" in payload)) return fallback;
  const error = payload.error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function Photo({ src, alt, className = "", priority = false }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return <Image src={src} alt={alt} fill unoptimized priority={priority} sizes="(max-width: 700px) 100vw, 700px" className={className} />;
}

function Brand({ onClick }: { onClick: () => void }) {
  return <button className="brand" type="button" onClick={onClick} aria-label="Lumora Beauty home"><span>LUMORA</span><small>BEAUTY</small></button>;
}

function Progress({ current }: { current: number }) {
  const labels = ["YOUR FACE", "FIND YOUR LOOK", "YOUR LUMORA"];
  return <div className="progress" aria-label={`Step ${current} of 3: ${labels[current - 1]}`}>{labels.map((label, index) => {
    const step = index + 1;
    return <div className={`progress-step ${step === current ? "is-current" : ""} ${step < current ? "is-complete" : ""}`} key={label}><span>{String(step).padStart(2, "0")}</span><span className="visually-hidden">{label}</span></div>;
  })}</div>;
}

function UploadField({ image, onChange, title, compact = false }: { image: LocalImage | null; onChange: (event: ChangeEvent<HTMLInputElement>) => void; title: string; compact?: boolean }) {
  return <label className={`upload-field ${compact ? "upload-field-compact" : ""} ${image ? "has-upload" : ""}`}>
    <input className="visually-hidden" type="file" accept="image/*" onChange={onChange} aria-label={image ? `Replace ${title.toLowerCase()}` : title} />
    {image ? <><span className="upload-image"><Photo src={image.src} alt={`Selected ${title.toLowerCase()}`} /></span><span className="replace-copy"><span className="upload-symbol"><Icon name="refresh" /></span> Replace {title.toLowerCase()}</span></> : <span className="upload-empty"><span className="upload-symbol"><Icon name="plus" /></span><span>{title}</span></span>}
  </label>;
}

function LookCard({ look, selected, onSelect }: { look: CuratedLook; selected: boolean; onSelect: () => void }) {
  return <button className={`look-card ${selected ? "is-selected" : ""}`} type="button" aria-pressed={selected} onClick={onSelect}>
    <span className="look-image" style={{ backgroundColor: look.tone }}><Photo src={look.image} alt={`${look.name} makeup inspiration`} /></span>
    <span className="look-copy"><strong>{look.name}</strong><small>{look.description}</small></span><span className="look-check">{selected && <Icon name="check" />}</span>
  </button>;
}

function RequirementGroupCard({ group, categories }: { group: RequirementGroup; categories: LookAnalysisCategories }) {
  const slots = group.slots.map((slot) => ({ ...slot, analysis: categories[slot.key] }));
  const confidence = slots.reduce((total, slot) => total + slot.analysis.confidenceScore, 0) / slots.length;

  return <article className="product-option">
    <div className="option-heading"><div><span className="option-eyebrow">{slots.length} analyzed categor{slots.length === 1 ? "y" : "ies"}</span><h3>{group.title}</h3></div></div>
    <p>{group.subtitle}</p>
    <div className="product-strip" style={{ gridTemplateColumns: `repeat(${Math.max(2, slots.length)},minmax(0,1fr))` }} aria-label={`Analyzed makeup requirements: ${group.title}`}>
      {slots.map(({ key, label, analysis }) => {
        const details = [
          analysis.description,
          `Product category: ${analysis.productCategory ?? "unknown"}`,
          `Colour family: ${analysis.colourFamily ?? "unknown"}`,
          `Undertone: ${analysis.undertone ?? "unknown"}`,
          `Finish: ${analysis.finish ?? "unknown"}`,
          `Intensity: ${analysis.intensity ?? "unknown"}`,
          analysis.characteristics.length ? `Characteristics: ${analysis.characteristics.join(", ")}` : null,
        ].filter(Boolean).join(". ");
        return <div className="product-mini" key={key}>
          <span className="product-thumb analysis-thumb" title={details} aria-label={details}>
            <strong>{analysis.colourFamily ?? "Colour unknown"}</strong>
            <em>{analysis.finish ?? "Finish unknown"}</em>
          </span>
          <small>{label}</small>
          <span className="analysis-slot-meta">{analysis.undertone ?? "Undertone unknown"} · {analysis.intensity ?? "Intensity unknown"}</span>
        </div>;
      })}
    </div>
    <div className="option-footer"><span><small>Analysis confidence</small><strong>{Math.round(confidence * 100)}%</strong></span><span className="analysis-source">No product feed connected</span></div>
  </article>;
}

export default function LumoraExperience() {
  const [screen, setScreen] = useState<Screen>("landing");
  const [originalImage, setOriginalImage] = useState<LocalImage | null>(null);
  const [inspirationPhoto, setInspirationPhoto] = useState<LocalImage | null>(null);
  const [selectedLook, setSelectedLook] = useState<CuratedLook | null>(null);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [tutorialReadyFor, setTutorialReadyFor] = useState<string | null>(null);
  const [tutorialLoading, setTutorialLoading] = useState(false);
  const [generationLine, setGenerationLine] = useState(0);
  const [generationAttempt, setGenerationAttempt] = useState(0);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [needsNewPhoto, setNeedsNewPhoto] = useState(false);
  const [comparison, setComparison] = useState<"before" | "after">("after");
  const [region, setRegion] = useState("Netherlands");
  const [feedback, setFeedback] = useState("");
  const [lookAnalysis, setLookAnalysis] = useState<LookAnalysis | null>(null);
  const [lookAnalysisError, setLookAnalysisError] = useState<string | null>(null);
  const startedGenerationAttempt = useRef<number | null>(null);
  const jobIdRef = useRef<string | null>(null);
  const recoverJobRef = useRef(false);
  const storyFileRef = useRef<{ src: string; file: File } | null>(null);

  useEffect(() => {
    const storedJobId = readStoredJobId();
    if (!storedJobId) return;
    jobIdRef.current = storedJobId;
    recoverJobRef.current = true;
    const timer = window.setTimeout(() => { setGenerationAttempt(1); setScreen("generating"); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => () => { if (originalImage?.src.startsWith("blob:")) URL.revokeObjectURL(originalImage.src); }, [originalImage]);
  useEffect(() => () => { if (inspirationPhoto?.src.startsWith("blob:")) URL.revokeObjectURL(inspirationPhoto.src); }, [inspirationPhoto]);
  useEffect(() => {
    if ((screen !== "share" && screen !== "result") || !generatedImage || storyFileRef.current?.src === generatedImage) return;
    let isActive = true;
    createStoryFile(generatedImage).then((file) => { if (isActive) storyFileRef.current = { src: generatedImage, file }; }).catch(() => undefined);
    return () => { isActive = false; };
  }, [screen, generatedImage]);
  useEffect(() => {
    if (screen === "result" && resultId) trackEventOnce(`result_viewed:${resultId}`, "result_viewed", { provider: "openai" });
  }, [screen, resultId]);
  useEffect(() => {
    if (screen !== "generating" || startedGenerationAttempt.current === generationAttempt) return;
    startedGenerationAttempt.current = generationAttempt;
    let isActive = true;
    const lineTimer = window.setInterval(() => setGenerationLine((line) => (line + 1) % generationLines.length), 1550);
    void (async () => {
      try {
        const recovering = recoverJobRef.current;
        recoverJobRef.current = false;
        if (!recovering && !originalImage) throw new Error("Upload your photo again before creating your Lumora.");
        const inspirationSource = inspirationPhoto?.src ?? selectedLook?.image;
        if (!recovering && !inspirationSource) throw new Error("Choose or upload an inspiration before creating your Lumora.");
        const jobId = jobIdRef.current ?? createJobId();
        jobIdRef.current = jobId;
        if (!recovering) trackEvent("generation_started", { provider: "openai", inspiration_source: inspirationPhoto ? "upload" : "curated", ...(selectedLook ? { inspiration_look_id: selectedLook.id } : {}) });
        storeJobId(jobId);
        const requestBody = recovering ? null : JSON.stringify({ jobId, originalImage: await imageAsDataUrl(originalImage!.src), inspirationImage: await imageAsDataUrl(inspirationSource!) });
        if (!isActive) return;
        let generationPayload: LookGenerationResult | null = null;
        let submitted = recovering;
        const deadline = Date.now() + 7 * 60 * 1000;
        while (!generationPayload) {
          if (!isActive) return;
          if (Date.now() > deadline) throw new GenerationTimeout();
          try {
            const response = !submitted
              ? await fetch("/api/look-generation", { method: "POST", headers: { "Content-Type": "application/json" }, body: requestBody })
              : await fetch(`/api/look-generation/${jobId}`, { cache: "no-store" });
            if (response.status === 404 && submitted && !recovering) { submitted = false; continue; }
            if (response.status === 404) throw new Error("We couldn't recover your Lumora. Please start again.");
            const payload = await response.json() as Partial<LookGenerationResult> & { status?: string; error?: unknown };
            if (response.status === 202) submitted = true;
            else if (response.ok && payload.status === "completed" && payload.previewDataUrl && payload.resultId) generationPayload = payload as LookGenerationResult;
            else if (response.status === 422) throw new NoUsableFaceError(apiErrorMessage(payload, "We couldn't find a clear face in this photo."));
            else if (response.status === 429) throw new RateLimitError(apiErrorMessage(payload, "Lumora couldn't create this image."));
            else if (response.status === 502 || response.status === 400 || response.status === 422 || response.status === 429 || (response.status === 503 && !submitted)) {
              throw new Error(apiErrorMessage(payload, "Lumora couldn't create this image."));
            }
            else if (response.ok) submitted = true;
          } catch (error) {
            // Network failures (for example Safari resuming from the background) are retried against the same job.
            if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
          }
          if (!generationPayload) await waitForPoll(2000);
        }
        trackEventOnce(`generation_completed:${jobId}`, "generation_completed", { provider: "openai", inspiration_source: inspirationPhoto ? "upload" : "curated" });
        clearStoredJobId();
        jobIdRef.current = null;
        if (!isActive) return;
        setGeneratedImage(generationPayload.previewDataUrl);
        setResultId(generationPayload.resultId);

        try {
          const analysisInput: LookAnalysisInput = {
            images: {
              generated: { uri: await analysisSafeImage(generationPayload.previewDataUrl), mediaType: "image/jpeg" },
            },
            ...(selectedLook ? { inspirationLookId: selectedLook.id } : {}),
          };
          const analysisResponse = await fetch("/api/look-analysis", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...analysisInput, resultId: generationPayload.resultId }),
          });
          const analysisPayload = await analysisResponse.json() as LookAnalysis | { error?: string | { code?: string; message?: string; retryAfterSeconds?: number } };
          if (!analysisResponse.ok || !("categories" in analysisPayload)) {
            throw new Error(apiErrorMessage(analysisPayload, "Look Analysis could not be completed."));
          }
          if (isActive) {
            setLookAnalysis(analysisPayload);
            setLookAnalysisError(null);
          }
        } catch (error) {
          if (isActive) setLookAnalysisError(error instanceof Error ? error.message : "Look Analysis could not be completed.");
        }
        if (isActive) {
          setGenerationError(null);
          setScreen("result");
        }
      } catch (error) {
        if (isActive) trackEvent("generation_failed", { provider: "openai", reason: error instanceof NoUsableFaceError ? "face_rejected" : error instanceof RateLimitError ? "rate_limit" : error instanceof GenerationTimeout ? "timeout" : error instanceof TypeError ? "network_error" : "generation_error" });
        if (!(error instanceof GenerationTimeout)) { clearStoredJobId(); jobIdRef.current = null; }
        if (isActive) setNeedsNewPhoto(error instanceof NoUsableFaceError);
        if (isActive) setGenerationError(error instanceof Error ? error.message : "Lumora couldn't create this image. Please try again.");
      }
    })();
    return () => { isActive = false; window.clearInterval(lineTimer); };
  }, [screen, originalImage, inspirationPhoto, selectedLook, generationAttempt]);

  function selectFace(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) setOriginalImage({ src: URL.createObjectURL(file), name: file.name });
    event.currentTarget.value = "";
  }
  function selectInspiration(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0];
    if (file) { setInspirationPhoto({ src: URL.createObjectURL(file), name: file.name }); setSelectedLook(null); }
    event.currentTarget.value = "";
  }
  function goBack() {
    setFeedback("");
    if (screen === "face") setScreen("landing");
    else if (screen === "inspiration") setScreen("face");
    else if (screen === "confirmation") setScreen("inspiration");
    else if (screen === "generating") setScreen("confirmation");
    else if (screen === "result") setScreen("confirmation");
    else setScreen("result");
  }
  async function shareLook(origin: "result" | "story" = "story") {
    setFeedback("");
    trackEvent("share_clicked", { origin: origin === "result" ? "result_screen" : "story_screen" });
    if (!resultId) {
      setFeedback("This Lumora could not be shared. Please try again.");
      return;
    }
    const shareUrl = new URL(`/share/${encodeURIComponent(resultId)}`, window.location.origin).toString();
    const text = "See the look. On you.";
    try {
      let storyFile = storyFileRef.current?.src === generatedImage ? storyFileRef.current.file : null;
      if (!storyFile && generatedImage) {
        try { storyFile = await createStoryFile(generatedImage); storyFileRef.current = { src: generatedImage, file: storyFile }; } catch { storyFile = null; }
      }
      if (storyFile && navigator.canShare?.({ files: [storyFile] })) {
        await navigator.share({ files: [storyFile], title: "My Lumora", text: `${text} ${shareUrl}` });
        trackEvent("share_completed", { method: "native_file" });
        return;
      }
      if (origin === "result") { setScreen("share"); return; }
      if (navigator.share) { await navigator.share({ title: "My Lumora", text, url: shareUrl }); trackEvent("share_completed", { method: "native_link" }); }
      else if (navigator.clipboard) { await navigator.clipboard.writeText(shareUrl); trackEvent("share_completed", { method: "copy_link" }); setFeedback("Link copied. Your share is always up to you."); }
      else setFeedback("Your Story is ready to share whenever you are.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("Share failed", error);
      setFeedback("Sharing isn't available here. Try Save Story instead.");
    }
  }
  async function saveStory() {
    setFeedback("");
    if (!generatedImage) { setFeedback("Your Story is not ready yet."); return; }
    try {
      const file = storyFileRef.current?.src === generatedImage ? storyFileRef.current.file : await createStoryFile(generatedImage);
      storyFileRef.current = { src: generatedImage, file };
      // iOS Safari ignores <a download>; the share sheet offers "Save Image" and "Save to Files".
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: "My Lumora Story" }); trackEvent("story_saved", { method: "share_sheet" }); return; }
        catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
          console.error("Save via share sheet failed", error);
        }
      }
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10000);
      trackEvent("story_saved", { method: "download" });
      setFeedback("Story saved.");
    } catch { setFeedback("Your Story could not be saved. Please try again."); }
  }
  async function createTutorial() {
    if (!resultId || tutorialLoading) return;
    setTutorialLoading(true);
    setFeedback("");
    trackEvent("tutorial_started");
    try {
      const response = await fetch("/api/look-tutorial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const payload = await response.json() as { status?: string; stepCount?: number; difficulty?: string; error?: unknown };
      if (!response.ok || payload.status !== "completed") throw new Error(apiErrorMessage(payload, "Your makeup tutorial couldn't be created. Please try again."));
      trackEventOnce(`tutorial_completed:${resultId}`, "tutorial_completed", { step_count: payload.stepCount ?? 0, difficulty: payload.difficulty ?? "unknown" });
      setTutorialReadyFor(resultId);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Your makeup tutorial couldn't be created. Please try again.");
    } finally {
      setTutorialLoading(false);
    }
  }
  async function beginCheckout() {
    if (!resultId || checkoutLoading) return;
    setCheckoutLoading(true);
    setFeedback("");
    try {
      const response = await fetch("/api/checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resultId }),
      });
      const payload = await response.json() as { url?: unknown; error?: unknown };
      if (!response.ok || typeof payload.url !== "string") {
        throw new Error(apiErrorMessage(payload, "Checkout is temporarily unavailable. Please try again."));
      }
      trackEvent("checkout_started", { value: 1.95, currency: "EUR" });
      window.location.assign(payload.url);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Checkout is temporarily unavailable. Please try again.");
      setCheckoutLoading(false);
    }
  }

  const resultImage = generatedImage ?? heroPortrait;
  const chosenInspiration = inspirationPhoto ? { src: inspirationPhoto.src, alt: "Your uploaded makeup inspiration" } : selectedLook ? { src: selectedLook.image, alt: `${selectedLook.name} makeup look` } : null;

  return <main className="site-shell">
    <header className="site-header">
      {screen !== "landing" && <button className="back-button" type="button" onClick={goBack} aria-label="Go back"><Icon name="arrow-left" /><span>Back</span></button>}
      <Brand onClick={() => setScreen("landing")} />
    </header>

    {screen === "landing" && <section className="landing-page">
      <div className="landing-art" aria-label="Editorial makeup portrait collage">
        <i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-coral" aria-hidden="true" />
        <div className="collage-main torn-bottom"><Photo src={heroPortrait} alt="Editorial beauty portrait with soft glowing makeup" priority /></div>
        <div className="collage-tilt collage-tilt-a tilt" aria-hidden="true"><Photo src="/look-glow.jpg" alt="" /></div>
        <div className="collage-tilt collage-tilt-b tilt" aria-hidden="true"><Photo src="/look-bold.jpg" alt="" /></div>
        <i className="sparkle sparkle-lg" aria-hidden="true" /><i className="powder" aria-hidden="true" />
      </div>
      <div className="landing-copy"><h1>See the look.<br /><em>On you.</em></h1>
        <p className="landing-intro">Upload a selfie and the makeup inspiration you love. Lumora brings them together while keeping you, you.</p>
        <button className="button button-primary landing-cta" type="button" onClick={() => setScreen("face")}>Create my look <Icon name="arrow-right" /></button>
        <p className="price-note">Free to try <span>·</span> HD download €1.95 <span>·</span> No subscription</p></div>
      <div className="landing-foot"><span>Private by default</span><span>No account needed</span><span>No beauty scores, ever</span></div>
    </section>}

    {screen === "face" && <section className="flow-page"><Progress current={1} /><div className="flow-hero"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-lilac" aria-hidden="true" /><div className="flow-hero-photo tilt"><Photo src="/look-soft-glam.jpg" alt="" /></div><i className="sparkle" aria-hidden="true" /><div className="flow-heading"><h1>Start with <em>you.</em></h1><p>Upload a clear photo of yourself.</p></div></div>
      <UploadField image={originalImage} onChange={selectFace} title="Upload your photo" /><p className="privacy-note"><Icon name="heart" /> Your photo is only used to create your look.</p>
      <div className="flow-footer"><button className="button button-primary" type="button" disabled={!originalImage} onClick={() => setScreen("inspiration")}>Continue <Icon name="arrow-right" /></button></div></section>}

    {screen === "inspiration" && <section className="flow-page inspiration-page"><Progress current={2} /><div className="flow-hero"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-lilac" aria-hidden="true" /><div className="flow-hero-photo tilt"><Photo src="/look-bold.jpg" alt="" /></div><i className="sparkle" aria-hidden="true" /><div className="flow-heading"><h1>Find your <em>look.</em></h1></div></div>
      <UploadField image={inspirationPhoto} onChange={selectInspiration} title="Upload inspiration" compact /><div className="or-divider"><span />or choose a look<span /></div>
      <div className="look-grid">{curatedLooks.map((look) => <LookCard key={look.id} look={look} selected={selectedLook?.id === look.id} onSelect={() => { setSelectedLook(look); setInspirationPhoto(null); }} />)}</div>
      <div className="flow-footer"><button className="button button-primary" type="button" disabled={!chosenInspiration} onClick={() => setScreen("confirmation")}>Continue <Icon name="arrow-right" /></button></div></section>}

    {screen === "confirmation" && originalImage && chosenInspiration && <section className="flow-page confirmation-page"><Progress current={3} /><div className="flow-heading"><h1>Ready to see <em>your look?</em></h1></div>
      <div className="confirmation-images"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-coral" aria-hidden="true" /><i className="sparkle" aria-hidden="true" /><figure><div className="confirmation-photo"><Photo src={originalImage.src} alt="Your uploaded photo" /></div></figure><figure><div className="confirmation-photo"><Photo src={chosenInspiration.src} alt={chosenInspiration.alt} /></div></figure></div>
      <button className="button button-primary create-button" type="button" onClick={() => { clearStoredJobId(); jobIdRef.current = null; setGenerationLine(0); setGeneratedImage(null); setResultId(null); setGenerationError(null); setNeedsNewPhoto(false); setLookAnalysis(null); setLookAnalysisError(null); setGenerationAttempt((attempt) => attempt + 1); setScreen("generating"); }}>Create my Lumora <Icon name="arrow-right" /></button>
      </section>}

    {screen === "generating" && <section className="generation-page" aria-live="polite" aria-atomic="true"><div className="generation-art"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-lilac" aria-hidden="true" /><i className="smear smear-coral" aria-hidden="true" /><div className="generation-photo tilt"><Photo src={originalImage?.src ?? heroPortrait} alt="Your portrait being prepared" /></div><i className="sparkle spark-one" aria-hidden="true" /><i className="sparkle spark-two" aria-hidden="true" /></div><h1>{generationLines[generationLine]}</h1>{generationError ? <div className="generation-error" role="alert"><p>{generationError}</p>{needsNewPhoto ? <button className="button button-secondary" type="button" onClick={() => { clearStoredJobId(); jobIdRef.current = null; setGenerationError(null); setNeedsNewPhoto(false); setOriginalImage(null); setScreen("face"); }}>Choose another photo <Icon name="arrow-right" /></button> : <button className="button button-secondary" type="button" onClick={() => { setGenerationError(null); setGenerationAttempt((attempt) => attempt + 1); }}>Try again <Icon name="arrow-right" /></button>}</div> : <><div className="progress-bar" aria-hidden="true"><span style={{ width: `${((generationLine + 1) / generationLines.length) * 100}%` }} /></div></>}</section>}

    {screen === "result" && <section className="result-page">
      <div className="result-visual"><i className="smear smear-pink" aria-hidden="true" /><i className="smear smear-lilac" aria-hidden="true" /><i className="smear smear-coral" aria-hidden="true" />
        <div className={`result-photo torn-bottom ${comparison === "before" ? "is-before" : "is-after"}`}><Photo src={comparison === "before" ? originalImage?.src ?? heroPortrait : generatedImage ?? heroPortrait} alt={comparison === "before" ? "Your original photo" : "Your Lumora makeup look"} priority /></div><div className="result-brand-mark">LUMORA <span>BEAUTY</span></div><i className="sparkle sparkle-lg" aria-hidden="true" />
        <div className="comparison-toggle" role="group" aria-label="Compare your photo and Lumora preview"><button type="button" className={comparison === "before" ? "active" : ""} aria-pressed={comparison === "before"} onClick={() => setComparison("before")}>Before</button><button type="button" className={comparison === "after" ? "active" : ""} aria-pressed={comparison === "after"} onClick={() => setComparison("after")}>After</button></div></div>
      <div className="result-heading"><h1>Your <em>Lumora</em></h1></div>
      <div className="result-actions">
        {resultId && tutorialReadyFor === resultId
          ? <a className="button button-primary" href={`/tutorial/${encodeURIComponent(resultId)}`} target="_blank" rel="noopener">View my makeup tutorial <Icon name="arrow-right" /></a>
          : <button className="button button-primary" type="button" disabled={!resultId || tutorialLoading} onClick={() => { void createTutorial(); }}>{tutorialLoading ? "Creating your tutorial…" : "Create my makeup tutorial"} <Icon name="arrow-right" /></button>}
        
        <div className="result-secondary">
          <button className="button button-secondary" type="button" disabled={!resultId || checkoutLoading} onClick={() => { void beginCheckout(); }}><Icon name="download" />{checkoutLoading ? "Opening Checkout…" : <>Download HD <span className="action-meta">€1.95</span></>}</button>
          <button className="button button-secondary" type="button" onClick={() => void shareLook("result")}><Icon name="share" />Share</button>
          {SHOW_GET_THIS_LOOK && <button className="button button-secondary" type="button" onClick={() => { setFeedback(""); trackEvent("get_this_look_clicked", { has_analysis: !!lookAnalysis }); setScreen("shop"); }}>Get this look <Icon name="arrow-right" /></button>}
        </div>
        </div>
      {process.env.NODE_ENV !== "production" && <details className="look-analysis-inspector"><summary>Development · Look analysis</summary>{lookAnalysisError ? <p role="status">{lookAnalysisError}</p> : lookAnalysis ? <pre>{JSON.stringify(lookAnalysis, null, 2)}</pre> : <p>Analysis is being prepared.</p>}</details>}
      {feedback && <p className="feedback" role="status">{feedback}</p>}</section>}

    {screen === "share" && <section className="share-page"><div className="flow-heading"><h1>Your Story is <em>ready.</em></h1></div>
      <div className="story-preview"><Photo src={resultImage} alt="Your Lumora in a social Story preview" /><div className="story-top"><span>LUMORA</span><small>BEAUTY, MADE PERSONAL</small></div><div className="story-bottom"><span>Made with Lumora</span><strong>See the look.<br /><em>On you.</em></strong><small>lumorabeauty.ai</small></div></div>
      <div className="share-actions"><button className="button button-primary" type="button" onClick={() => void shareLook()}>Share <Icon name="share" /></button><button className="button button-secondary" type="button" onClick={saveStory}>Save Story <Icon name="download" /></button></div><p className="privacy-note">Nothing is posted without your permission.</p>{feedback && <p className="feedback" role="status">{feedback}</p>}</section>}

    {screen === "shop" && <section className="shop-page"><div className="shop-heading"><div className="flow-heading"><span className="eyebrow">A FEW GOOD THINGS</span><h1>Get this look</h1><p>Everything you need to recreate your Lumora.</p></div>
      <label className="region-select">SHOPPING FOR <span aria-hidden="true">·</span><select value={region} onChange={(event) => setRegion(event.target.value)} aria-label="Shopping region"><option>Netherlands</option><option>Belgium</option><option>Germany</option><option>France</option></select></label></div>
      {lookAnalysis ? <div className="product-options">{requirementGroups.map((group) => <RequirementGroupCard key={group.id} group={group} categories={lookAnalysis.categories} />)}</div> : <p className="feedback" role="status">{lookAnalysisError ?? "Look Analysis is not available for this Lumora."}</p>}
      <p className="shopping-note">Analyzed makeup requirements only · No retailer or product feed is connected.</p>{feedback && <p className="feedback" role="status">{feedback}</p>}</section>}

    <SiteFooter minimal={screen === "face" || screen === "inspiration" || screen === "confirmation" || screen === "generating"} />
  </main>;
}