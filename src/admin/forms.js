import { bindDialog, closeDialog, openDialog } from "../shared/a11y.js";
import { qs } from "../shared/dom.js";
import { confirmDialog, toast } from "../shared/toast.js";

export function createJobForm({ api, jobsTable }) {
  const modal = qs("#createJobModal");
  const form = qs("#createJobForm");
  const errorEl = qs("#createJobError");
  const submitBtn = qs("#createJobSubmitBtn");
  const openBtn = qs("#btnCreateJob");
  const title = qs("#createJobModalTitle");
  let dirty = false;

  bindDialog(modal);
  form.addEventListener("input", () => { dirty = true; });

  function resetForm() {
    form.reset();
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    submitBtn.disabled = false;
    submitBtn.textContent = "Simpan Lowongan";
    title.textContent = "Tambah Lowongan Baru";
    qs("#editId").value = "";
    form.id.disabled = false;
    dirty = false;
  }

  function openCreate(triggerEl) {
    resetForm();
    openDialog(modal, triggerEl);
  }

  async function requestClose() {
    if (dirty) {
      const ok = await confirmDialog({
        title: "Tutup form?",
        message: "Perubahan yang belum disimpan akan hilang.",
        confirmText: "Tutup",
        cancelText: "Lanjut Edit",
      });
      if (!ok) return;
    }
    dirty = false;
    closeDialog(modal);
  }

  modal.addEventListener("dialog:close", (e) => {
    e.stopPropagation();
    requestClose();
  });
  modal.querySelectorAll("[data-close-dialog], [data-close-create-job]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      requestClose();
    }, true);
  });
  openBtn.addEventListener("click", () => openCreate(openBtn));

  function jobFromForm() {
    const fd = new FormData(form);
    const requirementsText = (fd.get("requirements") || "").toString().trim();
    const requirements = requirementsText
      ? requirementsText.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];
    return {
      id: (fd.get("id") || "").toString().trim(),
      gender: (fd.get("gender") || "all").toString(),
      slots: Number(fd.get("slots") || 0),
      company: {
        jp: (fd.get("companyJp") || "").toString().trim(),
        romaji: (fd.get("companyRomaji") || "").toString().trim(),
      },
      industry: (fd.get("industry") || "").toString().trim(),
      industryJp: (fd.get("industryJp") || "").toString().trim(),
      location: (fd.get("location") || "").toString().trim(),
      vacancies: Number(fd.get("slots") || 0),
      candidates: fd.get("candidates") ? Number(fd.get("candidates")) : 0,
      salary: {
        gross: Number(fd.get("salaryGross")),
        grossHourly: fd.get("salaryHourly") ? Number(fd.get("salaryHourly")) : null,
        net: Number(fd.get("salaryNet")),
      },
      interview: {
        date: fd.get("interviewDate"),
        type: fd.get("interviewType"),
      },
      description: (fd.get("description") || "").toString().trim(),
      requirements,
      mensetsuNotes: (fd.get("mensetsuNotes") || "").toString().trim(),
    };
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.classList.add("hidden");
    errorEl.textContent = "";
    const editId = qs("#editId").value;
    const job = jobFromForm();
    if (editId) job.id = editId;
    // Disable all form controls during submit to prevent double-save & signal busy state
    const allControls = form.querySelectorAll("input, select, textarea, button");
    allControls.forEach((el) => { el.disabled = true; });
    submitBtn.textContent = editId ? "MENYIMPAN PERUBAHAN..." : "MENYIMPAN...";
    try {
      const result = await api.saveJob(job, editId);
      dirty = false;
      closeDialog(modal);
      await jobsTable.load();
      toast({ message: `Lowongan "${result.job.company.romaji}" ${editId ? "diperbarui" : "ditambahkan"}.`, type: "success" });
    } catch (err) {
      errorEl.textContent = err.message || "Gagal menyimpan lowongan";
      errorEl.classList.remove("hidden");
      allControls.forEach((el) => { el.disabled = false; });
      submitBtn.textContent = editId ? "Simpan Perubahan" : "Simpan Lowongan";
    }
  });

  function edit(jobId) {
    const job = jobsTable.getJobs().find((item) => item.id === jobId);
    if (!job) {
      toast({ message: "Job tidak ditemukan.", type: "error" });
      return;
    }
    resetForm();
    title.textContent = "Edit Lowongan";
    qs("#editId").value = jobId;
    form.id.value = jobId;
    form.id.disabled = true;
    form.companyRomaji.value = job.company.romaji || "";
    form.companyJp.value = job.company.jp || "";
    form.industry.value = job.industry || "";
    form.industryJp.value = job.industryJp || "";
    form.location.value = job.location || "";
    form.slots.value = job.slots || job.vacancies || "";
    form.gender.value = job.gender || "all";
    form.candidates.value = job.candidates || "";
    form.salaryGross.value = job.salary?.gross || "";
    form.salaryHourly.value = job.salary?.grossHourly || "";
    form.salaryNet.value = job.salary?.net || "";
    form.interviewDate.value = job.interview?.date || "";
    form.interviewType.value = job.interview?.type || "offline";
    form.description.value = job.description || "";
    form.requirements.value = (job.requirements || []).join("\n");
    form.mensetsuNotes.value = job.mensetsuNotes || "";
    dirty = false;
    submitBtn.textContent = "Simpan Perubahan";
    openDialog(modal, qs(`[data-edit="${jobId}"]`));
  }

  return { edit };
}
