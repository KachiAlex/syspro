"use client";

import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Briefcase, MapPin, DollarSign, Users, Calendar, CheckCircle, Loader2, ArrowLeft, Upload, FileText, X } from "lucide-react";
import Link from "next/link";

interface Requisition {
  id: string;
  title: string;
  description: string;
  requirements: string | null;
  location: string | null;
  salaryRange: string | null;
  employmentType: string;
  headcount: number;
  minExperienceYears: number | null;
  requiredSkills: string[];
}

export default function ApplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const tenantSlug = searchParams.get("tenantSlug") || "";

  const [requisition, setRequisition] = useState<Requisition | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [coverLetter, setCoverLetter] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [education, setEducation] = useState("");
  const [skillsInput, setSkillsInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id || !tenantSlug) {
      setError("Missing requisition ID or tenant.");
      setLoading(false);
      return;
    }

    fetch(`/api/hr/requisitions/${id}?tenantSlug=${encodeURIComponent(tenantSlug)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load job details");
        return res.json();
      })
      .then((data) => {
        setRequisition(data.requisition);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load job details");
        setLoading(false);
      });
  }, [id, tenantSlug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenantSlug) return;
    setSubmitting(true);
    setError("");

    const skills = skillsInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      let finalResumeUrl = resumeUrl;

      // Upload resume file if selected
      if (resumeFile) {
        setUploadingResume(true);
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            const base64Data = result.split(',')[1];
            resolve(base64Data);
          };
          reader.onerror = reject;
          reader.readAsDataURL(resumeFile);
        });

        const uploadRes = await fetch("/api/hr/resumes/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: resumeFile.name,
            mimeType: resumeFile.type || "application/octet-stream",
            data: base64,
            tenantSlug,
          }),
        });

        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadData.error?.message || uploadData.error || "Resume upload failed");
        }
        finalResumeUrl = uploadData.resume?.url;
        setUploadingResume(false);
      }

      const res = await fetch("/api/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantSlug,
          requisitionId: id,
          fullName,
          email,
          phone: phone || undefined,
          resumeUrl: finalResumeUrl || undefined,
          coverLetter: coverLetter || undefined,
          experienceYears: experienceYears ? Number(experienceYears) : undefined,
          education: education || undefined,
          skills,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit application");
    } finally {
      setSubmitting(false);
      setUploadingResume(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Application Submitted!</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Thank you for applying. We will review your application and get back to you soon.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <p className="text-red-500 mb-4">{error || "Job not found."}</p>
          <Link href="/" className="text-blue-600 hover:underline">Back to Home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Job Header */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 md:p-8">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">{requisition.title}</h1>
              <div className="flex flex-wrap gap-3 text-sm text-gray-600 dark:text-gray-300">
                {requisition.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-4 h-4" /> {requisition.location}
                  </span>
                )}
                {requisition.salaryRange && (
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="w-4 h-4" /> {requisition.salaryRange}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Users className="w-4 h-4" /> {requisition.headcount} opening{requisition.headcount > 1 ? "s" : ""}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="w-4 h-4" /> {requisition.employmentType}
                </span>
                {requisition.minExperienceYears !== null && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-4 h-4" /> {requisition.minExperienceYears}+ yrs exp
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="prose dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
            <p className="whitespace-pre-line">{requisition.description}</p>
          </div>

          {requisition.requirements && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Requirements</h3>
              <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">{requisition.requirements}</p>
            </div>
          )}

          {requisition.requiredSkills.length > 0 && (
            <div className="mt-4">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Required Skills</h3>
              <div className="flex flex-wrap gap-2">
                {requisition.requiredSkills.map((skill) => (
                  <span key={skill} className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Application Form */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 md:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Apply for this position</h2>
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Full Name *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="John Doe"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                <input
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="john@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="+1 234 567 890"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resume *</label>
                <div className="relative">
                  {!resumeFile ? (
                    <label className="flex items-center justify-center w-full px-3 py-2 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setResumeFile(file);
                        }}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                        <Upload className="w-4 h-4" />
                        <span className="text-sm">Click to upload resume</span>
                      </div>
                    </label>
                  ) : (
                    <div className="flex items-center justify-between px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                      <div className="flex items-center gap-2 text-gray-700 dark:text-gray-200">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="text-sm truncate max-w-[200px]">{resumeFile.name}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => { setResumeFile(null); setResumeUrl(""); }}
                        className="p-1 rounded-md hover:bg-red-500/10 text-gray-400 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">PDF, DOC, DOCX, TXT, PNG, JPG, WEBP. Max 10MB.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Years of Experience</label>
                <input
                  type="number"
                  min={0}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Education</label>
                <input
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  placeholder="Bachelor's in Computer Science"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Skills (comma separated)</label>
              <input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="React, TypeScript, Node.js"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cover Letter</label>
              <textarea
                rows={4}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Tell us why you are a good fit..."
              />
            </div>

            <button
              type="submit"
              disabled={submitting || uploadingResume}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(submitting || uploadingResume) && <Loader2 className="w-4 h-4 animate-spin" />}
              {uploadingResume ? "Uploading resume..." : submitting ? "Submitting..." : "Submit Application"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
