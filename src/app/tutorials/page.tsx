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
    title: "Your First Time on MotionBoards",
    description: "First time? Here's everything you need. Canvas basics, tools, and your first AI generation. Takes about 3 minutes.",
    icon: <Sparkles className="h-5 w-5" />,
    category: "Basics",
    difficulty: "Beginner",
    duration: "3 min",
    steps: [
      { title: "Welcome to the Canvas", description: "When you open MotionBoards you'll see an infinite canvas with a prompt box in the center. This is your workspace. Click and drag on empty space to pan around, scroll to zoom in and out.", tip: "Top-right corner has zoom controls. Click the percentage to reset to 100%.", image: "/tutorials/01-canvas.png" },
      { title: "Generate Your First Image", description: "Type what you want in the prompt box, like 'A donkey riding a dragon, hyper realistic'. Then hit Generate or Ctrl+Enter. The AI generates it and places it right on your canvas. That's it, you're creating.", tip: "Default model is Nano Banana 2. Fast, affordable, great quality." },
      { title: "The Toolbar", description: "Top-left is where all your tools live. Select (V), Text (T), Draw (D), Connect (L), Upload, PSD Import/Export, and the Timeline editor. Everything one click away.", image: "/tutorials/02-toolbar.png" },
      { title: "Bottom Bar", description: "Bottom of the screen is your control center. Switch models, browse templates, open AI prompt helper, check generation history, and manage credits. Click the model name to explore 30+ AI models.", image: "/tutorials/03-bottombar.png" },
      { title: "Light/Dark Mode", description: "Prefer dark mode? Click the moon icon top-right. It saves automatically so you dont have to set it every time.", image: "/tutorials/04-darkmode.png" },
    ],
  },
  {
    id: "choosing-models",
    title: "Picking the Right AI Model",
    description: "30+ models available. Veo, Sora, Kling, Nano Banana, Flux and more. Here's how to pick the right one for what you're making.",
    icon: <Layers className="h-5 w-5" />,
    category: "Basics",
    difficulty: "Beginner",
    duration: "4 min",
    steps: [
      { title: "Browse All Models", description: "Click the model name at the bottom bar to open the model panel. Models are organized by category: Cinematic Video, Image Gen, Upscaling, Lip Sync, Audio. Pick what fits your project.", image: "/tutorials/05-models.png" },
      { title: "Text-to-Video (T2V)", description: "Want video from just text? Use Veo 3.1 Fast, Sora 2, or Kling 3.0. Type your prompt, hit generate, get a cinematic clip. No image needed, the AI imagines everything." },
      { title: "Image-to-Video (I2V)", description: "Have a great image and want it to move? Use Kling 3.0 I2V or Veo 3.1 I2V. Upload your image, set it as INPUT (right-click), then describe the motion. The AI animates your still.", tip: "Right-click your image and set as INPUT. You'll see a small preview above the prompt." },
      { title: "Text-to-Image (T2I)", description: "For images, Nano Banana 2 is best for speed and quality. Flux Dev for that artistic look. Recraft for clean design work. Fast generations, low cost." },
      { title: "Generation Options", description: "Each model has its own settings. Aspect ratio (16:9, 9:16, 1:1), duration (for videos), resolution (720p/1080p), audio toggle. These show as small pills above the prompt and change based on what model you're using." },
      { title: "Cost & Speed", description: "Every model shows the cost before you generate. Nano Banana ~RM0.18 per image. Veo 3.1 ~RM0.35 per video. Sora 2 Pro ~RM0.79. You see exactly what you're paying, no surprises." },
    ],
  },
  {
    id: "canvas-tools",
    title: "Canvas Tools: Text, Draw, Connect",
    description: "Not just generating. You can add text, draw, and connect items to organize your whole creative flow.",
    icon: <PenTool className="h-5 w-5" />,
    category: "Tools",
    difficulty: "Beginner",
    duration: "3 min",
    steps: [
      { title: "Select Tool (V)", description: "Default tool. Click to select, drag to move, corners to resize. Right-click anything for Download, Edit, Add to Timeline, or Delete." },
      { title: "Text Tool (T)", description: "Press T then click anywhere to place a text box. Double-click to edit. When selected, you get a full formatting bar with H1/H2/H3/Body/Small presets, font picker, size, bold, italic, alignment, and colors.", tip: "Use H1 for big titles, Body for descriptions. You can even add background colors.", image: "/tutorials/06-texttool.png" },
      { title: "Draw Tool (D)", description: "Press D and draw freehand on the canvas. Pick your color and stroke width from the toolbar. Release to finish, your drawing becomes a movable item you can resize.", tip: "Perfect for quick annotations, arrows, or sketching ideas over your generations.", image: "/tutorials/07-drawtool.png" },
      { title: "Connect Tool (L)", description: "Press L, click one item, then click another. Creates a dashed line connecting them. Click the line to remove it. Use this to map out your storyboard or show which image feeds into which video.", tip: "Great for organizing your workflow. Connect your input image to the generated video to keep track." },
    ],
  },
  {
    id: "uploading-media",
    title: "Upload Your Own Stuff",
    description: "Drag in your images, videos, audio, even PSD files. Everything goes straight on the canvas.",
    icon: <Upload className="h-5 w-5" />,
    category: "Tools",
    difficulty: "Beginner",
    duration: "2 min",
    steps: [
      { title: "Drag & Drop", description: "Literally just drag any file from your computer onto the canvas. Images, videos, audio — it'll upload and appear right where you drop it. No extra steps." },
      { title: "Toolbar Upload", description: "Click the image+ icon in the toolbar to open a file picker. You can select multiple files at once and they'll all land on your canvas." },
      { title: "Paste from Clipboard", description: "Screenshot something? Ctrl+V to paste it directly onto the canvas. Works with any image you've copied from anywhere." },
      { title: "PSD Import/Export", description: "Working with Photoshop? Import PSD files and each layer becomes its own item on the canvas. Export your canvas back as a layered PSD. Seamless workflow." },
      { title: "Right-Click Menu", description: "Right-click any item for the good stuff: Download it, Edit (crop/filters for images), Add to Timeline, or Delete. All one click away." },
    ],
  },
  {
    id: "image-to-video",
    title: "Turn Your Images into Videos",
    description: "Have a great image? Turn it into a moving video with one prompt. This is the I2V workflow, probably the most satisfying thing ever.",
    icon: <Video className="h-5 w-5" />,
    category: "Workflows",
    difficulty: "Intermediate",
    duration: "3 min",
    steps: [
      { title: "Start with an Image", description: "Generate an image with Nano Banana 2 or upload your own. This becomes the first frame of your video — so make sure it looks the way you want." },
      { title: "Switch to an I2V Model", description: "Click the model selector and pick an image-to-video model. Veo 3.1 I2V for cinematic stuff, Kling 3.0 I2V for consistent motion, Wan 2.2 I2V for creative looks." },
      { title: "Set Your Image as INPUT", description: "Click your image on the canvas to select it. You'll see a 'Set as:' bar appear. Click INPUT 1 to lock it in as the reference image.", tip: "A small thumbnail appears above the prompt showing your selected input. That's how you know it's set." },
      { title: "Describe the Motion", description: "Now write what you want to happen: 'Camera slowly pushes in, wind blows through hair, clouds drift across sky.' Be specific about the motion — the AI follows your description." },
      { title: "Hit Generate", description: "Ctrl+Enter or click Generate. Your video drops on the canvas right next to the original image. Right-click to download. That's the workflow — image in, video out." },
    ],
  },
  {
    id: "start-to-end",
    title: "Start-to-End Frame Videos",
    description: "Control exactly where your video starts and ends. Give the AI two images and it fills in the motion between them.",
    icon: <Play className="h-5 w-5" />,
    category: "Workflows",
    difficulty: "Intermediate",
    duration: "3 min",
    steps: [
      { title: "Get Two Images Ready", description: "You need a start frame and an end frame. Generate them or upload your own. These are your anchor points — the video will smoothly transition between them." },
      { title: "Pick the S2E Model", description: "Select Veo 3.1 Fast S2E from the model panel. This is the model that takes two frames and creates the motion in between." },
      { title: "Set Start & End Frames", description: "Click your first image > hit 'Start Frame'. Click your second image > hit 'End Frame'. Both show up as thumbnails above the prompt. Now the AI knows where to begin and where to end." },
      { title: "Describe What Happens", description: "Write a prompt describing the transition: 'Smooth camera movement, natural lighting shift, character walks forward.' The more specific, the better the result." },
      { title: "Generate & Watch", description: "Hit generate and the AI creates a smooth video that flows from your start image to your end image. It's like magic — two stills become cinema." },
    ],
  },
  {
    id: "timeline-editor",
    title: "The Timeline: Edit & Export Videos",
    description: "Got multiple clips? Combine them into one video. Trim, reorder, export. All in the browser, no extra software needed.",
    icon: <Film className="h-5 w-5" />,
    category: "Editing",
    difficulty: "Intermediate",
    duration: "4 min",
    steps: [
      { title: "Open the Timeline", description: "Click the film icon in the toolbar. The timeline editor opens at the bottom of your canvas — dark UI, professional look." },
      { title: "Add Your Clips", description: "Right-click any image or video on the canvas > 'Add to Timeline'. It appears in the track. Images default to 3 seconds, videos use their full length." },
      { title: "Drag to Reorder", description: "Just drag clips left and right to change the order. First clip plays first, second plays second. Simple." },
      { title: "Trim Your Clips", description: "Hover on the left or right edge of any clip — you'll see a trim handle. Drag it to cut the start or end. For images, adjust how long they show on screen." },
      { title: "Preview Clips", description: "Click any clip to see its preview in the left panel. Click on the timecode ruler to move your playhead to any position." },
      { title: "Export Your Video", description: "When you're happy, click 'Export'. It renders everything into a single 1920x1080 video file. All done in your browser — no FFmpeg, no downloads, no hassle.", tip: "Best results when all clips have the same aspect ratio. Different ratios get letterboxed automatically." },
    ],
  },
  {
    id: "ai-prompt-helper",
    title: "AI Prompt Generator",
    description: "Not sure what to write? Let the AI help you craft the perfect prompt. Like having a cinematography expert right there with you.",
    icon: <Wand2 className="h-5 w-5" />,
    category: "Tips",
    difficulty: "Beginner",
    duration: "2 min",
    steps: [
      { title: "Open the AI Chat", description: "Click the 'AI' button at the bottom bar. A chat panel opens — powered by GPT-4o, specialized in cinematography and creative prompts." },
      { title: "Just Tell It What You Want", description: "Talk to it like a normal person: 'I want a cinematic shot of nasi lemak being plated in slow motion.' It'll write you a detailed, optimized prompt that gets fire results." },
      { title: "One-Click Use", description: "See a prompt you like? Hit 'Use as prompt' and it automatically pastes into your generation box. Or copy it and tweak it yourself." },
      { title: "Quick Inspiration", description: "When the chat is empty, you'll see suggestion pills — cinematic drone shots, slow motion scenes, anime styles. Click any of them to get started instantly." },
    ],
  },
  {
    id: "credits-topup",
    title: "Credits & Top-Up",
    description: "No subscriptions. No packages. Just top up whatever amount you want (min RM10) and generate. You only pay for what you use.",
    icon: <CreditCard className="h-5 w-5" />,
    category: "Account",
    difficulty: "Beginner",
    duration: "1 min",
    steps: [
      { title: "How It Works", description: "MotionBoards is pay-per-use. Every generation costs a small amount (shown next to the model name). No monthly fees, no commitments. Top up when you need, use when you want." },
      { title: "Check Your Balance", description: "Click the profile icon (bottom-right corner). Your balance shows as RM amount. You can see exactly how much you have left." },
      { title: "Top Up Any Amount", description: "In the profile panel, type any amount (minimum RM10) and hit 'Top Up'. Stripe handles the payment — secure, instant. Credits appear in your account right away." },
      { title: "What Things Cost", description: "Nano Banana image: ~RM0.18. Veo 3.1 video: ~RM0.35. Sora 2 Pro: ~RM0.79. The cost is always shown BEFORE you generate — no hidden charges, no surprises. You see it, you decide." },
    ],
  },
  {
    id: "keyboard-shortcuts",
    title: "Keyboard Shortcuts",
    description: "Once you know these, you'll be way faster. Quick reference for all the shortcuts.",
    icon: <HelpCircle className="h-5 w-5" />,
    category: "Tips",
    difficulty: "Beginner",
    duration: "1 min",
    steps: [
      { title: "Tool Shortcuts", description: "V = Select, T = Text, D = Draw, L = Connect. Escape = back to Select and cancel whatever you're doing. Muscle memory kicks in fast." },
      { title: "Move Around", description: "Scroll = Zoom in/out. Click + drag empty space = Pan. Space + drag = Pan (temporary). Alt + click = Pan. You'll be navigating without thinking about it." },
      { title: "Undo & Delete", description: "Ctrl+Z = Undo. Ctrl+Y or Ctrl+Shift+Z = Redo. Delete or Backspace = Remove selected item. The essentials." },
      { title: "Generate Fast", description: "Ctrl+Enter = Generate with current prompt and model. No need to click the button. Type, hit the shortcut, done." },
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
          <h2 className="text-2xl font-bold mb-2">Learn MotionBoards in Minutes</h2>
          <p className="text-sm text-white/80 max-w-md mx-auto">
            Everything you need to know — from your first generation to advanced workflows. No fluff, just the good stuff.
          </p>
          <div className="flex items-center justify-center gap-6 mt-6 text-white/60 text-xs">
            <span>{tutorials.length} tutorials</span>
            <span>{tutorials.reduce((s, t) => s + t.steps.length, 0)} steps</span>
            <span>Beginner to Pro</span>
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
