# GFP 009 — DIGITAL CREATIVITY / KREATIVITI DIGITAL
## Group Assignment Report

# MicroMentor
### A Workplace Micro‑Learning App for Faster Onboarding and Continuous Upskilling
*Designed using the **AMPLIFY** model (Alias & Abdul Razak, 2024, Universiti Malaya)*

---

**Institution:** Universiti Malaya
**Course:** GFP 009 — Digital Creativity (Kreativiti Digital)
**Assignment:** Assignment 1 (40 marks) + Assignment 2 (60 marks)

**Group members (max. 3):**

| No. | Name | Matric No. | Role in project |
|-----|------|-----------|-----------------|
| 1 | *[Your name]* | *[Matric]* | Team lead / Problem research |
| 2 | *[Member 2]* | *[Matric]* | Design & prototyping |
| 3 | *[Member 3]* | *[Matric]* | Project management & documentation |

**Lecturer:** *[Lecturer name]*
**Submission date:** *[Date]*

> **How to use this document:** This is your master report. Paste each section into your e‑portfolio platform, and lift the highlighted points into your presentation slides. Replace everything in *[brackets]* with your real details. A slide outline and an e‑portfolio layout are provided at the end.

---

## Table of Contents

**Assignment 1 (40 marks)**
1. Introduction
2. Problem Statement
3. Use of Technology in the Area Being Investigated
4. Reflection on Future Use

**Assignment 2 (60 marks)**
5. Project Management
6. Processes — Designing the Solution (Define · Ideate · Prototype · Test · Evaluate)
7. Storyboard
8. Recommendations for Improvement & Peer Evaluation
9. Conclusion and Recommendations
10. Documentation of Group Discussions & Meetings

- Appendix A — The AMPLIFY Model at a Glance
- References

---

# ASSIGNMENT 1 (40 MARKS)

## 1. Introduction *(5%)*

Every organisation depends on how quickly its people can learn — a new hire must become productive, and existing staff must keep pace with tools, policies and skills that change faster every year. Yet the way most workplaces still deliver learning has barely changed: long induction days, thick manuals, and occasional half‑day training sessions that pull staff off the job. The result is predictable — people forget most of what they were told within days, managers repeat the same explanations, and productivity suffers during the very period a business can least afford it.

This project proposes **MicroMentor**, a mobile‑first **micro‑learning** application that delivers workplace knowledge in short, focused 3–5 minute lessons that employees complete *in the flow of work* — on the shop floor, at the desk, or between shifts. Instead of one overwhelming training day, learning is broken into small, repeatable, personalised "snacks" that fit naturally into a working day.

Crucially, MicroMentor is not designed by intuition alone. It is built by applying the **AMPLIFY model** — a micro‑learning design framework developed at Universiti Malaya by Nurul Fitriah Alias under the supervision of Assoc. Prof. Dr. Rafiza Abdul Razak (2024), which has been validated in Malaysian higher education and reported to improve learning outcomes by roughly 40%. AMPLIFY structures our design around seven components: clear objectives, personalised content, continuous feedback, efficient delivery, interactive experiences, social interaction, and seamless integration. This report shows how each component becomes a concrete design decision in an *appropriate technology* for the workplace.

This report is organised in two parts. **Assignment 1** frames the problem, reviews the technology currently used in workplace learning, and reflects on where the field is heading. **Assignment 2** covers project management and the full design process — defining, ideating, prototyping, testing and evaluating — including a storyboard, peer evaluation, and documentation of our group work.

---

## 2. Problem Statement *(10%)*

### 2.a The issue we are trying to solve — history and background

Workplace learning has moved through three broad eras. For most of the 20th century, training meant **classroom instruction and printed manuals** — an approach inherited from formal schooling. From the 2000s, organisations adopted **e‑learning and Learning Management Systems (LMS)**, moving those same long courses onto a screen. In the last decade, the limitation of both became clear: it is not the *medium* that fails learners, but the *format*. Long, front‑loaded content is fundamentally mismatched with how human memory works.

This is not a new insight. In 1885, Hermann Ebbinghaus documented the **"forgetting curve"** — showing that without reinforcement, people forget an estimated 50–80% of newly learned information within days (Ebbinghaus, 1885/1913). Cognitive‑load theory (Sweller, 1988) later explained *why*: working memory can only hold a few items at once, so cramming a full manual into one session overloads it and little is retained. **Micro‑learning** — delivering content in short, spaced, focused units — is the design response to both findings, and research reviews confirm it improves retention and engagement compared with traditional long‑form training (Leong et al., 2021; Hug, 2005).

**The concrete problem in the workplace today:**
- **Onboarding is slow and inconsistent.** New hires wait for the next scheduled induction, then receive a firehose of information in one or two days. Knowledge lives in the heads of senior staff and is passed on unevenly.
- **Continuous upskilling is neglected.** Once onboarded, employees rarely get structured refreshers on updated procedures, safety rules, or new tools — until something goes wrong.
- **Training removes people from work.** A full‑day session costs a day of productivity per attendee, which is especially painful for SMEs and shift‑based/frontline industries (retail, F&B, logistics, manufacturing) that dominate the Malaysian economy.
- **Low retention wastes the investment.** Because content is long and unreinforced, most of it is forgotten — so the money and time spent on training do not translate into lasting capability.

### 2.b Significance of the issue to us / our team

As university students about to enter the workforce, we have all experienced the "first week overwhelm" of internships and part‑time jobs — being handed a manual or shown a process once and expected to remember it. We have also seen the employer's side: managers in our families' small businesses spend hours re‑explaining the same tasks to each new staff member. This issue is personal and immediate for us, and it connects directly to the theme of GFP 009 — using creativity to design *appropriate technology* that solves a real, everyday problem rather than a hypothetical one.

Micro‑learning is also a natural match for our generation's habits: we already learn in short bursts from short‑form video and mobile apps. Designing a workplace tool around that behaviour, rather than fighting it, is both authentic and defensible.

### 2.c Justification of the need to solve this issue

- **Economic scale.** SMEs make up the vast majority of business establishments in Malaysia and employ a large share of the workforce; most cannot afford dedicated corporate training departments or expensive LMS licences. An affordable, lightweight tool addresses a genuine gap.
- **High cost of poor onboarding.** Slow onboarding and weak retention increase mistakes, safety incidents, and staff turnover — all of which are far more expensive than the training itself.
- **Skills are changing faster.** As digital tools and regulations change more frequently, one‑off training cannot keep up; continuous, bite‑sized refreshers are needed.
- **Evidence base exists.** Micro‑learning is not a guess — it is supported by cognitive science and by validated frameworks such as AMPLIFY. The need is therefore both real and *addressable with current, appropriate technology*.

### 2.d Objectives of the project

1. **To design** a mobile‑first workplace micro‑learning application (MicroMentor) that delivers job knowledge in 3–5 minute lessons employees can complete in the flow of work.
2. **To apply** all seven components of the AMPLIFY model as explicit design decisions, demonstrating a structured, theory‑grounded creative process rather than ad‑hoc design.
3. **To produce and test** a clickable prototype with representative users (peers acting as new employees and managers) and gather feedback on clarity, usefulness and engagement.
4. **To evaluate** the concept for sustainability and commercialisation as an appropriate, low‑cost technology suitable for Malaysian SMEs — without requiring further financial implications for the university/course.

---

## 3. Use of Technology in the Area Being Investigated *(10%)*

### 3.1 Technologies previously used in workplace learning (current research)

| Era | Technology | Strengths | Weaknesses (why it fails the problem) |
|-----|-----------|-----------|----------------------------------------|
| Traditional | Classroom sessions, printed manuals, shadowing | Human contact; hands‑on | Not scalable; forgotten quickly; removes staff from work; inconsistent |
| E‑learning 1.0 | LMS (e.g. Moodle, corporate LMS), SCORM courses | Central records; anywhere access | Long courses moved to a screen — same overload; low completion; costly for SMEs |
| Video training | Recorded webinars, YouTube playlists | Cheap, visual | Passive; no personalisation, feedback, or tracking; easy to tune out |
| Mobile / micro‑learning | Apps such as Duolingo (language) and workplace tools (e.g. Axonify, EdApp/SC Training, 7taps) | Short lessons, spaced repetition, gamified, mobile | Mostly Western/enterprise‑priced; not tailored to SME budgets or local context |

Research consensus (Leong et al., 2021; Hug, 2005; Kapp, 2012) is that **short, spaced, interactive, and social** learning outperforms long‑form delivery for retention and engagement — which is exactly the design space micro‑learning and gamification occupy.

### 3.2 Current status of use with new technologies

Micro‑learning has moved from niche to mainstream, enabled by four converging technologies:
- **Smartphones as the primary device** — near‑universal ownership means learning can go where the worker is.
- **Cloud + no‑code content tools** — managers can now author lessons without a developer, drastically lowering cost.
- **Gamification & spaced‑repetition engines** — streaks, points, and scheduled review prompts (based on the forgetting curve) are now standard app features.
- **AI‑assisted content and personalisation** — generative AI can draft lessons and quizzes from an existing manual, and adaptive algorithms tailor what each learner sees next.

**Where the gap remains:** most mature micro‑learning products are enterprise‑priced and built for large Western firms. There is little that is *affordable, bilingual (BM/English), and simple enough for a Malaysian SME or frontline team* — which is the appropriate‑technology opportunity MicroMentor targets. This is where our design applies AMPLIFY to make deliberate choices (see Appendix A and Section 6).

---

## 4. Reflection on Future Use *(5%)*

Micro‑learning is likely to become the *default* mode of workplace learning, not a supplement. Three trends will shape how MicroMentor and similar apps are used:

1. **AI‑generated and adaptive content.** Soon a manager will drop in a PDF policy or a short video, and AI will draft a lesson, questions, and a personalised review schedule automatically. This turns content creation — today's biggest barrier — into minutes of work, and lets the app adapt difficulty to each learner (directly amplifying AMPLIFY's *Personalised Content* and *Continuous Feedback*).
2. **Learning "in the flow of work."** Integration with the tools people already use (WhatsApp, Teams, POS systems, wearables on a factory floor) means lessons and just‑in‑time reminders appear at the exact moment of need, rather than in a separate app.
3. **Skills‑based, verifiable credentials.** Completed micro‑lessons will increasingly roll up into portable micro‑credentials/badges that follow the worker between jobs, supporting Malaysia's lifelong‑learning and TVET agenda.

**Risks to design for:** notification fatigue, superficial "tick‑box" learning if lessons are poorly written, data privacy of employee performance, and the digital divide for older or less tech‑confident workers. A responsible future design keeps lessons genuinely useful, keeps performance data private and non‑punitive, and keeps the interface simple and bilingual. Applied well, the technology's future is to make continuous learning invisible and effortless — exactly the appropriate‑technology outcome this course asks us to pursue.

---

# ASSIGNMENT 2 (60 MARKS)

## 5. Project Management *(10 marks)*

### 5.a Timeline (aligned to the course schedule)

Assuming a 14‑week semester, our project runs in parallel with the GFP 009 schedule:

| Week | Course phase | Project milestone (deliverable) | AMPLIFY link |
|------|--------------|--------------------------------|--------------|
| 1–2 | Course intro, problem framing | Team formed; problem chosen; research on workplace learning | — |
| 3–4 | Problem definition | **Assignment 1** problem statement + technology review drafted | A (objectives) |
| 5 | AMPLIFY model taught | Map all 7 AMPLIFY components to design decisions | A–Y |
| 6 | Ideation | Brainstorm features; sketch user flows | I, F |
| 7 | *Assignment 1 submission + presentation* | Submit report & e‑portfolio; present | — |
| 8–9 | Prototyping | Build clickable prototype (Figma/Canva) + storyboard | M, L, I |
| 10–11 | Testing | Usability test with 5–8 peers as "employees/managers"; collect feedback | P |
| 12 | Evaluation & iteration | Refine prototype from test findings; peer evaluation | P, F |
| 13 | Finalise | Budget, sustainability & commercialisation write‑up; documentation | Y |
| 14 | *Assignment 2 submission + presentation* | Submit report & e‑portfolio; present | — |

*(Represent this as a simple Gantt chart in your slides — one bar per row.)*

### 5.b Sustainability of the project *(no further financial implications)*

The project is deliberately designed to be completed **using only free tools and no additional spend beyond what the course already requires:**
- **Design & prototype:** Figma (free education plan) or Canva (free) for the clickable prototype and storyboard.
- **Content:** written by the team from freely available sample workplace procedures; images from free stock/AI tools.
- **Testing:** conducted with fellow students — no incentive costs.
- **Hosting the e‑portfolio:** the university's provided e‑portfolio platform (Google Sites / Mahara / provided LMS) at no cost.

Because MicroMentor is a *concept and prototype* for this assignment, there is **no ongoing financial commitment** to the university. Should it be developed further, it is architected to stay low‑cost (see commercialisation). Environmentally, a digital micro‑learning tool also *reduces* the printing of manuals and travel to training venues.

### 5.c Commercialisation

If taken to market, MicroMentor targets **Malaysian SMEs and frontline teams** that cannot afford enterprise LMS licences:
- **Model:** freemium SaaS — free for up to 5 employees and a limited number of lessons; low monthly per‑seat fee (e.g. an SME‑friendly RM/seat/month) for unlimited lessons, analytics and branding.
- **Go‑to‑market:** partner with SME associations, industry training bodies, and HRD Corp‑claimable training (Malaysia) so employers can use existing levies; bilingual (BM/English) content as a differentiator versus Western apps.
- **Moat:** a growing library of localised, ready‑made lesson templates (e.g. F&B hygiene, retail POS, workplace safety) that SMEs can adopt instantly.
- **Social angle:** supports national upskilling / lifelong‑learning goals, strengthening grant and CSR‑partnership potential.

### 5.d Others (creativity)

- **Bilingual & low‑literacy friendly:** lessons support Bahasa Melayu and English with audio and images, widening access.
- **"Manager‑as‑author" in minutes:** any supervisor can turn a task into a lesson from their phone — no instructional‑designer needed.
- **Offline mode** for factory floors and areas with poor connectivity.
- **Non‑punitive analytics:** dashboards highlight *where the team needs support*, framed as coaching rather than surveillance.

---

## 6. Processes — Designing the Solution *(30 marks)*

We used a design‑thinking process (Define → Ideate → Prototype → Test → Evaluate), with the **AMPLIFY model** as the lens guiding every decision.

### 6.1 Define

**Design challenge:** *"How might we help SME employees learn and remember their jobs without taking them off the job for long, forgettable training sessions?"*

**Target users:**
- *Aina, 22 — new retail assistant.* Nervous first week; too much to remember; learns best on her phone.
- *Encik Rashid, 45 — café owner/manager.* No time or budget for formal training; re‑explains tasks constantly.

**Design requirements derived from the problem:** short lessons, mobile, personalised, gives feedback, engaging, social, and tied to real job outcomes — i.e. the seven AMPLIFY components.

### 6.2 Ideate — applying the AMPLIFY model

This is the heart of our creative process. Each AMPLIFY component is translated into a concrete MicroMentor feature:

| AMPLIFY component | Design decision / feature in MicroMentor |
|-------------------|------------------------------------------|
| **A — Clear Learning Objectives** | Every lesson opens with one plain‑language outcome: *"After this, you can open the till correctly."* One lesson = one skill. |
| **M — Personalised Content** | A short onboarding quiz + role selection tailors each person's learning path; the app skips what they know and prioritises weak spots. |
| **P — Continuous Feedback** | Instant right/wrong feedback with explanations; spaced‑repetition reminders based on the forgetting curve; a private progress bar. |
| **L — Efficient Content Delivery** | 3–5 minute lessons: a short video/image + 2–3 quick questions. Mobile‑first, offline‑capable, bilingual. |
| **I — Interactive Experiences** | Tap, drag, scenario ("what would you do if a customer…?"), and mini‑quizzes — never passive reading. |
| **F — Social Interaction** | Team leaderboard, peer "high‑fives," and a Q&A wall where staff ask and answer real job questions. |
| **Y — Seamless Curriculum Integration** | Lessons are grouped into role "playlists" that map to the company's actual SOPs and onboarding checklist, so learning aligns with real work. |

### 6.3 Prototype

We built a **clickable prototype** (in Figma/Canva) of the core flow. Key screens:
1. **Onboarding & role select** (feeds *M*).
2. **Home / "Today's lessons"** — 2–3 bite‑sized cards with clear objectives (*A, L*).
3. **Lesson screen** — short video/visual + interactive question (*I, L*).
4. **Instant feedback screen** — correct/incorrect + explanation (*P*).
5. **Progress & streak** — private progress, spaced review reminders (*P*).
6. **Team wall / leaderboard** — social layer (*F*).
7. **Manager dashboard** — create a lesson in minutes; see where the team needs help (*Y*).

*(See the storyboard in Section 7 for the narrative of these screens.)*

### 6.4 Test

We ran a **usability test with 5–8 peers** playing two roles: new employees completing lessons, and a manager creating one. Method: task‑based observation + a short post‑test survey (System Usability Scale‑style questions + open feedback).

**What we measured:** time to complete a lesson, task success rate, perceived usefulness/clarity, and whether the objective of each lesson was understood.

**Representative findings (fill in with your real results):**
- ✅ Users completed a lesson in under 4 minutes and liked the short format ("felt easy, not like studying").
- ✅ The clear objective at the start (*A*) was consistently praised.
- ⚠️ Some users wanted the feedback (*P*) to explain *why* an answer was wrong, not just mark it.
- ⚠️ The manager flow (*Y*) needed fewer steps to publish a lesson.
- ⚠️ A few wanted the leaderboard (*F*) to be optional, to avoid pressure.

### 6.5 Evaluate & iterate

We fed findings back into the design:
- Added a one‑line **explanation** to every feedback screen (*strengthens P*).
- **Reduced the manager "create lesson" flow** from 6 steps to 3 (*strengthens Y and adoption*).
- Made the **leaderboard opt‑in / team‑only** to keep social interaction positive, not stressful (*refines F*).
- Added a **bilingual toggle** after observing mixed‑language preference (*supports M, L*).

This define→ideate→prototype→test→evaluate loop, guided by AMPLIFY, is our evidence of a structured creative process rather than a one‑shot idea.

---

## 7. Storyboard *(with descriptions)*

A six‑frame storyboard tells MicroMentor's story from a user's point of view. *(Draw/insert these as illustrated panels in your booklet and slides; the descriptions below are your captions.)*

| Frame | Visual | Description (caption) |
|-------|--------|------------------------|
| **1 — The problem** | Aina, a nervous new retail assistant, buried under a thick printed manual on day one; a clock shows a long day. | *"Aina's first day: too much to remember, all at once. By tomorrow she'll forget most of it."* |
| **2 — Discovery** | Manager Rashid hands Aina her phone showing the MicroMentor app: "Just do 3 short lessons today." | *"Instead of a manual, Aina gets bite‑sized lessons on her phone — right where she works."* |
| **3 — Learning (A + L + I)** | Phone screen: a 3‑minute lesson "Open the till correctly," with a short clip and a tap‑to‑answer question. | *"Each lesson has one clear goal and takes minutes. Aina taps to answer — she's doing, not just reading."* |
| **4 — Feedback (P)** | Screen shows a green check and a short "why" explanation; a progress streak fills up. | *"Instant feedback tells her not just what's right, but why. A gentle reminder will bring it back tomorrow so she remembers."* |
| **5 — Social (F)** | Team wall: colleagues give a "high‑five"; Aina asks a real question and a senior staffer answers. | *"Aina learns with her team — asking questions and cheering each other on."* |
| **6 — Outcome (M + Y)** | Confident Aina serves a customer smoothly; Rashid's dashboard shows the team's progress and where to help. | *"By week's end Aina is confident and productive — and Rashid sees exactly where his team needs support. Everyone wins."* |

---

## 8. Recommendations for Improvement & Peer Evaluation

### 8.1 Recommendations for improvement (next iterations)
1. **AI lesson generator** — auto‑draft lessons and quizzes from an uploaded SOP/PDF to remove the content‑creation barrier.
2. **WhatsApp/Teams integration** — push a daily lesson where staff already are, boosting completion.
3. **Micro‑credentials/badges** — issue verifiable badges per completed playlist to support portable skills.
4. **Deeper analytics for managers** — highlight team‑wide weak spots to target coaching.
5. **Accessibility** — audio narration and larger‑text mode for low‑literacy or older workers.

### 8.2 Peer evaluation *(within the group)*

Each member rates the others (and self) on contribution. *(Fill in honestly; keep as evidence.)*

| Criterion (score 1–5) | Member 1 | Member 2 | Member 3 |
|------------------------|:--------:|:--------:|:--------:|
| Attendance & participation in meetings | | | |
| Quality & timeliness of contributions | | | |
| Collaboration & communication | | | |
| Creativity / problem‑solving input | | | |
| **Total /20** | | | |

**Reflection (2–3 sentences each):** *[Each member writes what their teammates did well and one suggestion.]*

---

## 9. Conclusion and Recommendations for Submission *(5 marks)*

Workplace learning is stuck in a long‑form format that fights against how memory works — costing businesses time, money and retained knowledge. **MicroMentor** answers this with an appropriate, low‑cost, mobile micro‑learning technology, designed not by guesswork but by systematically applying Universiti Malaya's **AMPLIFY** model: clear objectives, personalised content, continuous feedback, efficient delivery, interactive and social experiences, and seamless integration with real work. Our design‑thinking process — define, ideate, prototype, test and evaluate — turned each AMPLIFY component into a concrete, user‑tested feature, and our testing confirmed the core idea while showing exactly what to refine.

**Recommendations for submission and beyond:**
- Submit the report and e‑portfolio, and present the storyboard + prototype demo as the highlight.
- For future development: build the AI lesson generator and WhatsApp integration first, since they remove the biggest adoption barriers.
- Pilot with one real SME (e.g. a campus café or a family business) to gather authentic data before any commercialisation.

MicroMentor demonstrates the central lesson of GFP 009: creativity is most powerful when it is *directed at a real problem* and *structured by a sound model* — here, AMPLIFY — to produce technology that is genuinely appropriate for the people who will use it.

---

## 10. Documentation of Group Discussions & Meetings *(5 marks)*

*(Keep this as a running log with photos/screenshots of your meetings in the e‑portfolio. Template below — fill in real dates and content.)*

| Meeting | Date | Attendees | Agenda | Decisions & actions | Evidence |
|---------|------|-----------|--------|---------------------|----------|
| M1 | *[Wk 1]* | All | Form team, pick problem area | Chose workplace learning problem | Photo/screenshot |
| M2 | *[Wk 3]* | All | Draft problem statement & research | Assigned sections for Assignment 1 | Doc link |
| M3 | *[Wk 5]* | All | Map AMPLIFY to features | Agreed 7‑feature table (Sec 6.2) | Whiteboard photo |
| M4 | *[Wk 8]* | All | Build prototype & storyboard | Split screens & storyboard frames | Figma link |
| M5 | *[Wk 11]* | All | Review usability test results | Listed 4 fixes to iterate | Survey results |
| M6 | *[Wk 13]* | All | Finalise report & e‑portfolio | Assigned final edits & slides | Draft link |

**Communication channels:** WhatsApp group for daily coordination; shared Google Drive folder for documents; Figma for design. *(Insert screenshots as evidence.)*

---

## Appendix A — The AMPLIFY Model at a Glance

**AMPLIFY** is a micro‑learning design framework developed by **Nurul Fitriah Alias**, supervised by **Assoc. Prof. Dr. Rafiza Abdul Razak**, at **Universiti Malaya** (Ph.D., 2024), and validated in Malaysian higher education.

| Letter | Component | Meaning |
|:------:|-----------|---------|
| **A** | Clear Learning Objectives | Every lesson is outcome‑driven — one clear goal. |
| **M** | Personalised Content | Materials adapt to each learner's needs and level. |
| **P** | Continuous Feedback | Ongoing feedback supports improvement and clarity. |
| **L** | Efficient Content Delivery | Technology delivers concise, high‑impact learning. |
| **I** | Interactive Experiences | Learners actively participate, not passively read. |
| **F** | Social Interaction | Collaboration and knowledge‑sharing among learners. |
| **Y** | Seamless Curriculum Integration | Micro‑learning aligns with broader goals/curriculum. |

Its strength is *holistic integration* — the seven components work together, not in isolation. In this project each becomes a concrete MicroMentor feature (Section 6.2).

---

## References *(APA 7th — verify formatting against your faculty guide)*

Alias, N. F., & Abdul Razak, R. (2024). *AMPLIFY: A framework for microlearning in higher education* [Doctoral dissertation, Universiti Malaya]. Universiti Malaya. Summary: *Amplifying learning: Revolutionising higher education with microlearning practices.* UM Research Bulletin. https://www.umresearchbulletin.com/post/amplifying-learning

Brown, T. (2008). Design thinking. *Harvard Business Review, 86*(6), 84–92.

Ebbinghaus, H. (1913). *Memory: A contribution to experimental psychology* (H. A. Ruger & C. E. Bussenius, Trans.). Teachers College, Columbia University. (Original work published 1885)

Hug, T. (2005). Micro learning and narration: Exploring possibilities of utilization of narrations and storytelling for the designing of "micro units" and didactical micro‑learning arrangements. *Proceedings of the Fourth Media in Transition Conference*, MIT.

Kapp, K. M. (2012). *The gamification of learning and instruction: Game‑based methods and strategies for training and education.* Pfeiffer.

Leong, K., Sung, A., Au, D., & Blanchard, C. (2021). A review of the trend of microlearning. *Journal of Work‑Applied Management, 13*(1), 88–102. https://doi.org/10.1108/JWAM-10-2020-0044

Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science, 12*(2), 257–285.

*(Add any local SME/HRD Corp statistics you cite in 2.c with proper sources.)*

---

## Appendix B — Presentation slide outline (for the 5% presentation)

1. **Title** — MicroMentor + group members
2. **The problem** — the forgetting curve + slow onboarding (storyboard frame 1)
3. **Why it matters** — significance + Malaysian SME scale
4. **Technology review** — old vs new (the Section 3 table, simplified)
5. **Our solution** — MicroMentor in one sentence + hero screen
6. **AMPLIFY applied** — the 7‑feature table (your key slide)
7. **Storyboard** — frames 2–6
8. **Prototype demo** — click through Figma
9. **Testing & what we changed** — 3 findings → 3 fixes
10. **Project management** — timeline, sustainability, commercialisation
11. **Future & conclusion** — AI + WhatsApp; the GFP 009 takeaway
12. **Thank you / Q&A**

## Appendix C — E‑portfolio layout (for the 5% e‑portfolio)

Create these pages/sections on your platform (Google Sites / Mahara / provided LMS):
1. **Home** — project title, tagline, team, one hero image.
2. **Problem** — Assignment 1 sections 1–2.
3. **Research** — Section 3 technology review + Section 4 reflection.
4. **The AMPLIFY Model** — Appendix A + the 7‑feature mapping.
5. **Design Process** — Section 6, with photos of sketches.
6. **Prototype & Storyboard** — embed Figma + storyboard images.
7. **Testing & Iteration** — results + before/after.
8. **Project Management** — timeline, budget, sustainability, commercialisation.
9. **Team & Documentation** — meeting log, peer evaluation, reflections.
10. **References.**
