"use client";

import { useState } from "react";
import { ArrowLeft, Play, ChevronRight, Sparkles, Upload, MousePointer, Type, PenTool, Link2, Film, Wand2, Layers, Download, ZoomIn, Image, Video, CreditCard, Sun, HelpCircle } from "lucide-react";

interface Step {
  title: string;
  description: string;
  tip?: string;
  image?: string;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
  duration: string;
  steps: Step[];
}

const tutorials: Tutorial[] = [
  {
    id: "getting-started",
    title: "Getting Started with MotionBoards",
    description: "Learn the basics: navigate the canvas, understand the interface, and generate your first AI image.",
    icon: <Sparkles className="h-5 w-5" />,
    category: "Basics",
    difficulty: "Beginner",
    duration: "3 min",
    steps: [
      { title: "The Canvas", description: "When you open MotionBoards, you'll see an infinite canvas with a centered prompt box. This is your workspace — you can pan by clicking and dragging on empty space, and zoom with your scroll wheel.", tip: "Use the zoom controls in the top-right corner to reset to 100%.", image: "/tutorials/01-canvas.png" },
      { title: "Your First Generation", description: "Type a description in the prompt box (e.g., 'A dragon flying over mountains at sunset') and click the Generate button or press Ctrl+Enter. The AI will create an image and place it on your canvas.", tip: "The default model is Nano Banana 2 — great for fast, high-quality images." },
      { title: "The Toolbar", description: "The top-left toolbar has your creative tools: Select (V), Text (T), Draw (D), Connect (L), Upload, Import/Export PSD, and the Timeline editor.", image: "/tutorials/02-toolbar.png" },
      { title: "Bottom Bar", description: "The bottom bar shows your current model, templates, AI prompt helper, generation history, and profile/credits. Click the model name to switch between 30+ AI models.", image: "/tutorials/03-bottombar.png" },
      { title: "Dark Mode", description: "Click the moon icon in the top-right to switch to dark mode. Your preference is saved automatically.", image: "/tutorials/04-darkmode.png" },
    ],
  },
  {
    id: "choosing-models",
    title: "Choosing the Right AI Model",
    description: "Understand the different AI models available and when to use each one.",
    icon: <Layers className="h-5 w-5" />,
    category: "Basics",
    difficulty: "Beginner",
    duration: "4 min",
    steps: [
      { title: "Model Categories", description: "Models are organized by type: Cinematic Video (Veo, Sora, Kling), Image Generation (Nano Banana, Flux, Recraft), Upscaling (Topaz, SeedVR), Lip Sync, and Audio. Click the model name in the bottom bar to browse all categories.", image: "/tutorials/05-models.png" },
      { title: "Text-to-Video (T2V)", description: "Models like Veo 3.1 Fast and Sora 2 generate video from text descriptions. Just type your prompt and generate. Great for creating cinematic clips, animations, and motion content." },
      { title: "Image-to-Video (I2V)", description: "Models like Kling 3.0 I2V and Veo 3.1 I2V animate a still image. Upload or generate an image first, then right-click it and set it as INPUT before generating.", tip: "Set your image as INPUT using right-click or the reference controls that appear when you select an image." },
      { title: "Text-to-Image (T2I)", description: "Nano Banana 2, Flux Dev, and Recraft generate images from text. These are fast and great for concept art, product shots, and creative exploration." },
      { title: "Generation Options", description: "Each model has different options shown as pills above the prompt: Aspect Ratio (16:9, 9:16, 1:1), Duration (for videos), Resolution (720p/1080p or 0.5K-4K), and Audio toggle (Kling). These change based on the selected model." },
      { title: "Cost & Speed", description: "Each model shows its cost (e.g., ~RM0.18) and approximate generation time. Faster models like Nano Banana cost less. Premium models like Sora 2 Pro cost more but produce higher quality." },
    ],
  },
  {
    id: "canvas-tools",
    title: "Using Canvas Tools",
    description: "Master the text, drawing, and connection tools to organize and annotate your work.",
    icon: <PenTool className="h-5 w-5" />,
    category: "Tools",
    difficulty: "Beginner",
    duration: "3 min",
    steps: [
      { title: "Select Tool (V)", description: "The default tool. Click items to select them, drag to move them, use corner handles to resize. Right-click any item for options like Download, Edit, Add to Timeline, or Delete." },
      { title: "Text Tool (T)", description: "Click the T icon or press T, then click anywhere on the canvas to place a text box. Double-click the text to edit it. When selected, a formatting toolbar appears above with font presets (H1, H2, H3, Body, Small), font family, size, bold, italic, alignment, and color pickers.", tip: "Use H1 for titles, Body for descriptions. You can change the background color too.", image: "/tutorials/06-texttool.png" },
      { title: "Draw Tool (D)", description: "Click the pen icon or press D to freehand draw on the canvas. Choose your stroke color and width from the controls that appear in the toolbar. Click and drag to draw — release to finish. Your drawing becomes a movable, resizable item.", tip: "Great for quick annotations, arrows, or sketching ideas over your generations.", image: "/tutorials/07-drawtool.png" },
      { title: "Connect Tool (L)", description: "Click the link icon or press L, then click one item followed by another to create a dashed connection line between them. Click the line to remove it. Perfect for organizing workflows and showing relationships between images/videos.", tip: "Use connections to map out your storyboard or show which image was used as input for which video." },
    ],
  },
  {
    id: "uploading-media",
    title: "Uploading & Managing Media",
    description: "Import images, videos, audio files, and PSD files to your canvas.",
    icon: <Upload className="h-5 w-5" />,
    category: "Tools",
    difficulty: "Beginner",
    duration: "2 min",
    steps: [
      { title: "Drag & Drop", description: "Simply drag any image, video, or audio file from your computer onto the canvas. It will be uploaded and placed where you drop it." },
      { title: "Toolbar Upload", description: "Click the image+ icon in the top toolbar to open a file picker. Select one or multiple files to upload them to the canvas." },
      { title: "Paste from Clipboard", description: "Copy an image from anywhere (screenshot, browser, etc.) and press Ctrl+V to paste it directly onto the canvas." },
      { title: "PSD Import/Export", description: "Click the upload icon to import Photoshop PSD files — each layer becomes a separate item on the canvas. Use the download icon to export all canvas images as a layered PSD file." },
      { title: "Right-Click Menu", description: "Right-click any item for options: Download (save to your computer), Edit (crop/filters for images), Add to Timeline, or Delete." },
    ],
  },
  {
    id: "image-to-video",
    title: "Turning Images into Videos",
    description: "Use the I2V workflow to animate your images with AI video models.",
    icon: <Video className="h-5 w-5" />,
    category: "Workflows",
    difficulty: "Intermediate",
    duration: "3 min",
    steps: [
      { title: "Generate or Upload an Image", description: "First, create an image using Nano Banana 2 or upload one from your computer. This will be the starting frame for your video." },
      { title: "Select an I2V Model", description: "Click the model selector in the bottom bar and choose an image-to-video model like Veo 3.1 Fast I2V, Kling 3.0 Pro I2V, or Wan 2.2 I2V." },
      { title: "Set the Image as INPUT", description: "Click your image on the canvas to select it. A 'Set as:' bar appears above the prompt. Click INPUT 1 to mark it as the input image for the next generation.", tip: "You'll see a small thumbnail preview above the prompt textarea showing your selected input." },
      { title: "Write a Motion Prompt", description: "Describe the motion you want: 'Camera slowly zooms in, clouds move in the background, dragon flaps its wings'. The AI will animate your image based on this description." },
      { title: "Generate", description: "Click Generate or press Ctrl+Enter. The video will appear on the canvas next to your original image. Right-click the video to download it." },
    ],
  },
  {
    id: "start-to-end",
    title: "Start-to-End Video Generation",
    description: "Create videos with specific start and end frames using S2E models.",
    icon: <Play className="h-5 w-5" />,
    category: "Workflows",
    difficulty: "Intermediate",
    duration: "3 min",
    steps: [
      { title: "Prepare Two Images", description: "Generate or upload two images: one for the start frame and one for the end frame. These define what the video begins and ends with." },
      { title: "Select an S2E Model", description: "Choose Veo 3.1 Fast S2E from the model selector. This model creates a video that transitions between your two frames." },
      { title: "Set Start & End Frames", description: "Select your first image and click 'Start Frame' in the reference bar. Then select your second image and click 'End Frame'. Both will show as small thumbnails above the prompt." },
      { title: "Describe the Transition", description: "Write a prompt describing the transition: 'Smooth camera movement from interior to exterior, natural lighting transition from warm to cool'." },
      { title: "Generate", description: "The AI will create a video that starts with your first image and ends with your second, with smooth AI-generated motion in between." },
    ],
  },
  {
    id: "timeline-editor",
    title: "Using the Timeline Editor",
    description: "Combine multiple clips into a single video using the built-in timeline.",
    icon: <Film className="h-5 w-5" />,
    category: "Editing",
    difficulty: "Intermediate",
    duration: "4 min",
    steps: [
      { title: "Open the Timeline", description: "Click the film icon in the top toolbar to open the timeline editor at the bottom of the screen." },
      { title: "Add Clips", description: "Right-click any image or video on the canvas and select 'Add to Timeline'. The clip appears in the timeline track. Images default to 3 seconds, videos to their full duration." },
      { title: "Reorder Clips", description: "Drag clips left and right in the timeline to reorder them. The clip order determines the final video sequence." },
      { title: "Trim Videos", description: "Hover over the left or right edge of a video clip in the timeline — drag the trim handles to set start and end points. For images, drag to adjust their display duration." },
      { title: "Preview", description: "Click on any clip in the timeline to see its preview thumbnail in the left panel. Click on the timecode ruler to move the playhead." },
      { title: "Export", description: "Click 'Export' to render all clips into a single 1920x1080 video file (WebM format). The export uses your browser's built-in video encoding.", tip: "For best results, use clips with the same aspect ratio. The exporter will letterbox clips that don't match." },
    ],
  },
  {
    id: "ai-prompt-helper",
    title: "Using the AI Prompt Generator",
    description: "Let AI help you write better prompts for stunning results.",
    icon: <Wand2 className="h-5 w-5" />,
    category: "Tips",
    difficulty: "Beginner",
    duration: "2 min",
    steps: [
      { title: "Open the AI Chat", description: "Click the 'AI' button in the bottom bar to open the AI Prompt Generator panel. It's powered by GPT-4o and specializes in cinematography prompts." },
      { title: "Describe Your Idea", description: "Tell the AI what you want in plain language: 'I want a cinematic shot of a coffee being poured in slow motion'. The AI will craft a detailed, optimized prompt." },
      { title: "Use the Generated Prompt", description: "Click 'Use as prompt' on any AI response to automatically paste it into the generation prompt box. You can also copy it to edit further." },
      { title: "Quick Suggestions", description: "When the chat is empty, click any of the suggestion pills for instant inspiration: cinematic drone shots, slow motion scenes, anime styles, and more." },
    ],
  },
  {
    id: "credits-topup",
    title: "Managing Credits & Top-Up",
    description: "Understand the pay-per-use system and how to top up your balance.",
    icon: <CreditCard className="h-5 w-5" />,
    category: "Account",
    difficulty: "Beginner",
    duration: "1 min",
    steps: [
      { title: "Pay Per Use", description: "MotionBoards uses a credit system. Each generation costs a different amount depending on the model (shown next to the model name). You only pay for what you generate." },
      { title: "Check Your Balance", description: "Click the profile icon in the bottom-right corner to see your current balance, displayed as RM amount." },
      { title: "Top Up", description: "In the profile panel, enter any amount (minimum RM10) and click 'Top Up'. You'll be redirected to Stripe for secure payment. Credits are added instantly after payment." },
      { title: "Cost Reference", description: "Image generation (Nano Banana): ~RM0.18. Video generation (Veo 3.1): ~RM0.35. Premium video (Sora 2 Pro): ~RM0.79. The cost is shown before you generate." },
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description: "Speed up your workflow with these essential shortcuts.",
    icon: <HelpCircle className="h-5 w-5" />,
    category: "Tips",
    difficulty: "Beginner",
    duration: "1 min",
    steps: [
      { title: "Tool Shortcuts", description: "V = Select tool, T = Text tool, D = Draw tool, L = Connect tool. Press Escape to return to Select and cancel any active operation." },
      { title: "Canvas Navigation", description: "Scroll wheel = Zoom in/out. Click + drag on empty canvas = Pan. Space + drag = Pan (temporary). Alt + click = Pan." },
      { title: "Editing", description: "Ctrl+Z = Undo, Ctrl+Y or Ctrl+Shift+Z = Redo. Delete or Backspace = Remove selected item." },
      { title: "Generation", description: "Ctrl+Enter = Generate with current prompt and model." },
    ],
  },
];

const categories = ["All", "Basics", "Tools", "Workflows", "Editing", "Tips", "Account"];
const difficultyColors = {
  Beginner: "bg-green-100 text-green-700",
  Intermediate: "bg-yellow-100 text-yellow-700",
  Advanced: "bg-red-100 text-red-700",
};

export default function TutorialsPage() {
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [activeCategory, setActiveCategory] = useState("All");
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  const filtered = activeCategory === "All" ? tutorials : tutorials.filter((t) => t.category === activeCategory);

  const markComplete = (tutorialId: string, stepIdx: number) => {
    setCompletedSteps((prev) => new Set(prev).add(`${tutorialId}-${stepIdx}`));
  };

  const isStepComplete = (tutorialId: string, stepIdx: number) => completedSteps.has(`${tutorialId}-${stepIdx}`);
  const tutorialProgress = (t: Tutorial) => {
    const done = t.steps.filter((_, i) => isStepComplete(t.id, i)).length;
    return Math.round((done / t.steps.length) * 100);
  };

  // Tutorial detail view
  if (selectedTutorial) {
    const step = selectedTutorial.steps[activeStep];
    const progress = ((activeStep + 1) / selectedTutorial.steps.length) * 100;

    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-3">
          <div className="max-w-3xl mx-auto flex items-center gap-3">
            <button onClick={() => { setSelectedTutorial(null); setActiveStep(0); }} className="text-gray-400 hover:text-[#0d1117] transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </button>
            <img src="/logo.jpg" alt="MotionBoards" className="h-8 rounded" />
            <div className="flex-1">
              <h1 className="text-sm font-bold text-[#0d1117]">{selectedTutorial.title}</h1>
              <p className="text-[10px] text-gray-400">Step {activeStep + 1} of {selectedTutorial.steps.length}</p>
            </div>
            <a href="/generate" className="text-xs text-[#f26522] font-semibold hover:underline">Open Canvas</a>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-[#f26522] transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="max-w-3xl mx-auto px-6 py-10">
          {/* Step indicator dots */}
          <div className="flex items-center gap-1.5 mb-8 justify-center">
            {selectedTutorial.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveStep(i)}
                className={`h-2.5 rounded-full transition-all ${
                  i === activeStep ? "w-8 bg-[#f26522]" : i < activeStep || isStepComplete(selectedTutorial.id, i) ? "w-2.5 bg-[#f26522]/40" : "w-2.5 bg-gray-200"
                }`}
              />
            ))}
          </div>

          {/* Step content */}
          <div className="text-center max-w-lg mx-auto">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-[#f26522]/10 text-[#f26522] mb-6">
              <span className="text-xl font-bold">{activeStep + 1}</span>
            </div>
            <h2 className="text-xl font-bold text-[#0d1117] mb-3">{step.title}</h2>
            <p className="text-sm text-gray-600 leading-relaxed mb-6">{step.description}</p>

            {step.image && (
              <div className="mb-6 rounded-xl overflow-hidden border border-gray-200 shadow-lg">
                <img src={step.image} alt={step.title} className="w-full" />
              </div>
            )}

            {step.tip && (
              <div className="bg-[#f26522]/5 border border-[#f26522]/20 rounded-xl px-4 py-3 text-left mb-6">
                <p className="text-[11px] text-[#f26522] font-semibold mb-0.5">Pro Tip</p>
                <p className="text-xs text-gray-600">{step.tip}</p>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-10 max-w-lg mx-auto">
            <button
              onClick={() => setActiveStep(Math.max(0, activeStep - 1))}
              disabled={activeStep === 0}
              className="px-4 py-2 text-xs font-medium text-gray-400 hover:text-[#0d1117] disabled:opacity-30 transition-colors"
            >
              Previous
            </button>

            <button
              onClick={() => {
                markComplete(selectedTutorial.id, activeStep);
                if (activeStep < selectedTutorial.steps.length - 1) {
                  setActiveStep(activeStep + 1);
                }
              }}
              className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                isStepComplete(selectedTutorial.id, activeStep)
                  ? "bg-green-100 text-green-700"
                  : "bg-gray-100 text-gray-600 hover:bg-[#f26522]/10 hover:text-[#f26522]"
              }`}
            >
              {isStepComplete(selectedTutorial.id, activeStep) ? "Completed" : "Mark as done"}
            </button>

            {activeStep < selectedTutorial.steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-4 py-2 text-xs font-semibold text-[#f26522] hover:text-[#d9541a] flex items-center gap-1 transition-colors"
              >
                Next <ChevronRight className="h-3 w-3" />
              </button>
            ) : (
              <a
                href="/generate"
                className="px-4 py-2 text-xs font-semibold bg-[#f26522] text-white rounded-lg hover:bg-[#d9541a] transition-colors"
              >
                Start Creating
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Tutorial list view
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/generate" className="text-gray-400 hover:text-[#0d1117] transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </a>
            <img src="/logo.jpg" alt="MotionBoards" className="h-10 rounded" />
            <div>
              <h1 className="text-base font-bold text-[#0d1117]">Tutorials</h1>
              <p className="text-[10px] text-gray-400">Learn how to use MotionBoards</p>
            </div>
          </div>
          <a href="/generate" className="px-4 py-2 bg-[#f26522] text-white text-xs font-semibold rounded-lg hover:bg-[#d9541a] transition-colors">
            Open Canvas
          </a>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#f26522] to-[#d9541a] text-white px-6 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-2">Master MotionBoards</h2>
          <p className="text-sm text-white/80 max-w-md mx-auto">
            Step-by-step tutorials to help you create stunning AI-generated content. From basics to advanced workflows.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-white/60 text-xs">
            <span>{tutorials.length} tutorials</span>
            <span>{tutorials.reduce((s, t) => s + t.steps.length, 0)} steps</span>
            <span>All skill levels</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Category tabs */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-full whitespace-nowrap transition-colors ${
                activeCategory === cat
                  ? "bg-[#f26522] text-white"
                  : "bg-white text-gray-500 border border-gray-200 hover:border-[#f26522] hover:text-[#f26522]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Tutorial cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((tutorial) => {
            const progress = tutorialProgress(tutorial);
            return (
              <button
                key={tutorial.id}
                onClick={() => { setSelectedTutorial(tutorial); setActiveStep(0); }}
                className="text-left bg-white rounded-xl border border-gray-200 p-5 hover:border-[#f26522]/40 hover:-translate-y-0.5 hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-xl bg-[#f26522]/10 text-[#f26522] flex items-center justify-center shrink-0 group-hover:bg-[#f26522] group-hover:text-white transition-colors">
                    {tutorial.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-[#0d1117] truncate">{tutorial.title}</h3>
                    </div>
                    <p className="text-[11px] text-gray-500 line-clamp-2 mb-3">{tutorial.description}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${difficultyColors[tutorial.difficulty]}`}>
                        {tutorial.difficulty}
                      </span>
                      <span className="text-[9px] text-gray-400">{tutorial.duration}</span>
                      <span className="text-[9px] text-gray-400">{tutorial.steps.length} steps</span>
                    </div>
                    {/* Progress bar */}
                    {progress > 0 && (
                      <div className="mt-2.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-[#f26522] rounded-full transition-all" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-[#f26522] transition-colors shrink-0 mt-1" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-12 mb-8">
          <p className="text-xs text-gray-400 mb-3">Ready to create?</p>
          <a href="/generate" className="inline-flex items-center gap-2 px-6 py-3 bg-[#f26522] text-white text-sm font-semibold rounded-xl hover:bg-[#d9541a] transition-colors">
            <Sparkles className="h-4 w-4" />
            Open Canvas
          </a>
        </div>

        <p className="text-[10px] text-gray-300 text-center pb-4 flex items-center justify-center gap-1">
          Developed by <img src="/adletic-logo.jpg" alt="Adletic" className="h-4 w-4 rounded-sm" /> <span className="font-semibold text-gray-400">Adletic</span> &copy; 2026
        </p>
      </div>
    </div>
  );
}
