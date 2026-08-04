import { NextRequest, NextResponse } from "next/server";

export interface ParsedResumeData {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  skills: string[];
  education: string | null;
  experienceYears: number | null;
  coverLetter: string | null;
  rawText: string;
  warnings: string[];
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { filename, mimeType, data } = body as {
      filename: string;
      mimeType: string;
      data: string;
    };

    if (!filename || !data) {
      return NextResponse.json(
        { error: "filename and data are required" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(data, "base64");
    let text = "";

    const isPdf =
      mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");
    const isDocx =
      mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      filename.toLowerCase().endsWith(".docx");
    const isDoc =
      mimeType === "application/msword" || filename.toLowerCase().endsWith(".doc");
    const isTxt =
      mimeType === "text/plain" || filename.toLowerCase().endsWith(".txt");

    if (isPdf) {
      const pdfParse = (await import("pdf-parse")) as any;
      const pdfData = await pdfParse(buffer);
      text = pdfData.text;
    } else if (isDocx) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (isTxt) {
      text = buffer.toString("utf-8");
    } else if (isDoc) {
      return NextResponse.json(
        {
          error:
            "Legacy .doc format is not supported. Please upload a PDF or DOCX file.",
        },
        { status: 400 }
      );
    } else {
      text = buffer.toString("utf-8");
    }

    if (!text || text.trim().length === 0) {
      return NextResponse.json(
        { error: "Could not extract any text from the uploaded file." },
        { status: 400 }
      );
    }

    const parsed = parseResumeText(text);

    return NextResponse.json({ success: true, parsed });
  } catch (error) {
    console.error("Resume parse failed:", error);
    return NextResponse.json(
      { error: "Failed to parse resume. Please ensure the file is a valid PDF or DOCX." },
      { status: 500 }
    );
  }
}

function parseResumeText(text: string): ParsedResumeData {
  const warnings: string[] = [];
  const cleanText = text.replace(/\r\n/g, "\n").replace(/\t/g, " ");
  const lines = cleanText.split("\n").map((l) => l.trim()).filter(Boolean);

  // 1. Extract email
  const emailMatch = cleanText.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/
  );
  const email = emailMatch ? emailMatch[0] : null;
  if (!email) warnings.push("Email address not found in resume");

  // 2. Extract phone
  const phoneMatch = cleanText.match(
    /(\+?\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]?\d{3,4}[\s.-]?\d{3,4}/
  );
  let phone: string | null = null;
  if (phoneMatch) {
    const raw = phoneMatch[0];
    if (raw.replace(/\D/g, "").length >= 7) {
      phone = raw.trim();
    }
  }
  if (!phone) warnings.push("Phone number not found in resume");

  // 3. Extract name (first non-empty line that doesn't look like contact info)
  let fullName: string | null = null;
  for (const line of lines.slice(0, 10)) {
    const lower = line.toLowerCase();
    if (
      line.length > 2 &&
      line.length < 60 &&
      !lower.includes("@") &&
      !lower.match(/\d{3,}/) &&
      !lower.startsWith("curriculum vitae") &&
      !lower.startsWith("resume") &&
      !lower.includes("profile") &&
      !lower.includes("address") &&
      !lower.includes("phone") &&
      !lower.includes("email") &&
      !lower.includes("linkedin") &&
      !lower.includes("github") &&
      !lower.includes("portfolio") &&
      !lower.includes("website") &&
      /^[a-zA-Z\s.'-]+$/.test(line) &&
      line.split(/\s+/).length >= 2 &&
      line.split(/\s+/).length <= 5
    ) {
      fullName = line.replace(/\s+/g, " ").trim();
      break;
    }
  }
  if (!fullName) warnings.push("Full name not found in resume");

  // 4. Extract skills
  const skills = extractSkills(cleanText);
  if (skills.length === 0) warnings.push("Skills not found in resume");

  // 5. Extract education
  const education = extractEducation(cleanText);
  if (!education) warnings.push("Education details not found in resume");

  // 6. Extract years of experience
  const experienceYears = extractExperienceYears(cleanText);
  if (experienceYears === null)
    warnings.push("Years of experience not found in resume");

  return {
    fullName,
    email,
    phone,
    skills,
    education,
    experienceYears,
    coverLetter: null,
    rawText: cleanText.substring(0, 5000),
    warnings,
  };
}

function extractSkills(text: string): string[] {
  const lowerText = text.toLowerCase();
  const found = new Set<string>();

  const SKILL_DICTIONARY = [
    // Programming languages
    "JavaScript", "TypeScript", "Python", "Java", "C++", "C#", "Go", "Rust",
    "Ruby", "PHP", "Swift", "Kotlin", "Scala", "R", "MATLAB", "Perl", "Dart",
    "HTML", "CSS", "SQL", "Bash", "Shell", "PowerShell",
    // Frontend
    "React", "React Native", "Next.js", "Vue", "Vue.js", "Angular", "Svelte",
    "SvelteKit", "jQuery", "Redux", "Tailwind", "TailwindCSS", "Bootstrap",
    "Material UI", "Sass", "LESS", "Webpack", "Vite", "Storybook",
    // Backend
    "Node.js", "Express", "NestJS", "Django", "Flask", "FastAPI", "Spring",
    "Spring Boot", "Laravel", "Rails", "ASP.NET", ".NET", "GraphQL", "REST",
    "gRPC", "Microservices", "API", "WebSocket",
    // Databases
    "PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite", "Oracle", "SQL Server",
    "DynamoDB", "Cassandra", "Elasticsearch", "Firebase", "Supabase", "Neon",
    // Cloud / DevOps
    "AWS", "Azure", "GCP", "Google Cloud", "Docker", "Kubernetes", "Terraform",
    "Ansible", "Jenkins", "CI/CD", "GitHub Actions", "GitLab CI", "CircleCI",
    "Vercel", "Netlify", "Cloudflare", "DigitalOcean", "Heroku",
    // Mobile
    "Android", "iOS", "Flutter", "Xamarin", "React Native", "Ionic",
    // Tools
    "Git", "GitHub", "GitLab", "Bitbucket", "Jira", "Confluence", "Figma",
    "Adobe XD", "Photoshop", "Illustrator", "Slack", "Notion", "Trello",
    "Asana", "Monday.com",
    // Data / AI
    "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Keras",
    "Pandas", "NumPy", "Scikit-learn", "Data Analysis", "Data Science",
    "NLP", "Computer Vision", "OpenAI", "LLM", "Tableau", "Power BI",
    // Methodologies
    "Agile", "Scrum", "Kanban", "DevOps", "TDD", "BDD", "Waterfall",
    "Project Management", "Product Management",
    // Business / Office
    "Excel", "Word", "PowerPoint", "Outlook", "SAP", "Salesforce", "HubSpot",
    "QuickBooks", "Xero", "FreshBooks",
    // Soft skills
    "Leadership", "Communication", "Teamwork", "Problem Solving",
    "Critical Thinking", "Time Management", "Negotiation", "Presentation",
    // Networking
    "TCP/IP", "DNS", "DHCP", "VPN", "Firewall", "Cisco", "Routing", "Switching",
    // Security
    "Cybersecurity", "Penetration Testing", "OWASP", "ISO 27001",
    "Information Security", "Network Security",
    // Accounting / Finance
    "Accounting", "Auditing", "Financial Analysis", "Bookkeeping",
    "Tax Preparation", "Payroll", "Budgeting", "Financial Reporting",
    // Other
    "Customer Service", "Sales", "Marketing", "SEO", "SEM", "Content Writing",
    "Copywriting", "Social Media", "Email Marketing", "Digital Marketing",
  ];

  for (const skill of SKILL_DICTIONARY) {
    const skillLower = skill.toLowerCase();
    const variants = [skillLower, skillLower.replace(/\./g, ""), skillLower.replace(/\s+/g, "")];
    for (const variant of variants) {
      if (lowerText.includes(variant)) {
        found.add(skill);
        break;
      }
    }
  }

  // Also look for a "Skills" section and extract items
  const skillsSectionMatch = text.match(
    /(?:skills|technical skills|core competencies|technologies|tech stack)[\s:]*\n([\s\S]*?)(?:\n\s*\n|[A-Z][a-z]+:|$)/i
  );
  if (skillsSectionMatch) {
    const sectionText = skillsSectionMatch[1];
    const items = sectionText
      .split(/[,\n•·|]/)
      .map((s) => s.trim())
      .filter((s) => s.length > 1 && s.length < 40);
    for (const item of items) {
      if (!found.has(item) && /^[a-zA-Z0-9\s.#+-]+$/.test(item)) {
        found.add(item);
      }
    }
  }

  return Array.from(found).slice(0, 30);
}

function extractEducation(text: string): string | null {
  const lowerText = text.toLowerCase();

  const DEGREE_PATTERNS = [
    /ph\.?d\.?/i,
    /doctorate/i,
    /master(?:'s)?\s+(?:of\s+)?(?:science|arts|business|engineering|technology|computer)/i,
    /m\.?s\.?c\.?/i,
    /m\.?a\.?/i,
    /m\.?b\.?a\.?/i,
    /m\.?eng\.?/i,
    /bachelor(?:'s)?\s+(?:of\s+)?(?:science|arts|business|engineering|technology|computer)/i,
    /b\.?s\.?c\.?/i,
    /b\.?a\.?/i,
    /b\.?eng\.?/i,
    /b\.?tech\.?/i,
    /hnd/i,
    /ond/i,
    /associate(?:'s)?\s+degree/i,
    /diploma/i,
    /certificate/i,
    /ssce/i,
    /waec/i,
    /neco/i,
    /a[- ]?level/i,
    /o[- ]?level/i,
  ];

  for (const pattern of DEGREE_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const startIdx = text.indexOf(match[0]);
      const lineStart = text.lastIndexOf("\n", startIdx) + 1;
      const lineEnd = text.indexOf("\n", startIdx);
      const line = text.substring(lineStart, lineEnd > 0 ? lineEnd : startIdx + 100).trim();
      return line.substring(0, 200);
    }
  }

  const eduSectionMatch = text.match(
    /(?:education|academic|qualifications)[\s:]*\n([\s\S]*?)(?:\n\s*\n|[A-Z][a-z]+:|$)/i
  );
  if (eduSectionMatch) {
    const sectionText = eduSectionMatch[1].trim();
    const firstLine = sectionText.split("\n")[0].trim();
    if (firstLine.length > 0) return firstLine.substring(0, 200);
  }

  return null;
}

function extractExperienceYears(text: string): number | null {
  const patterns = [
    /(\d+)\+?\s+years?\s+(?:of\s+)?(?:professional\s+)?experience/i,
    /(\d+)\+?\s+years?\s+(?:of\s+)?(?:work\s+)?experience/i,
    /experience:?\s*(\d+)\+?\s+years?/i,
    /(\d+)\+?\s+years?\s+(?:in|of)\s+(?:the\s+)?(?:field|industry|software|IT|tech)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const years = parseInt(match[1], 10);
      if (years >= 0 && years <= 60) return years;
    }
  }

  const expSectionMatch = text.match(
    /(?:experience|work history|employment history|professional experience)[\s:]*\n([\s\S]*?)(?:\n\s*\n|[A-Z][a-z]+:|$)/i
  );
  if (expSectionMatch) {
    const sectionText = expSectionMatch[1];
    const yearMatches = sectionText.matchAll(
      /(\b(?:19|20)\d{2}\b)\s*(?:[-–—to]+\s*)?(\b(?:19|20)\d{2}\b|present|current|now)/gi
    );
    let totalYears = 0;
    for (const m of yearMatches) {
      const startYear = parseInt(m[1], 10);
      const endStr = m[2].toLowerCase();
      const endYear =
        endStr === "present" || endStr === "current" || endStr === "now"
          ? new Date().getFullYear()
          : parseInt(m[2], 10);
      if (!isNaN(startYear) && !isNaN(endYear) && endYear >= startYear) {
        totalYears += endYear - startYear;
      }
    }
    if (totalYears > 0) return Math.min(totalYears, 50);
  }

  return null;
}
