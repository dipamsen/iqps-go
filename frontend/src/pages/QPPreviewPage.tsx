import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { makeRequest } from "../utils/backend";
import { ISearchResult } from "../types/question_paper";
import "./styles/qp_preview_page.scss";

export default function QPPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [paper, setPaper] = useState<ISearchResult>();

  async function getPaper() {
    setStatus("loading");
    const res = await makeRequest('get_paper', 'get', { id: Number(id) })
    if (res.status === "success") {
      setStatus("success");
      setPaper(res.data);
    }
  }

  useEffect(() => {
    if (id)
      getPaper();
  }, [])

  return <div id="qp-preview-page">
    {
      status === "success" && paper && <div className="paper-preview">
        <h2>{paper.course_name} ({paper.course_code})</h2>
        <embed src={paper.filelink} />
      </div>
    }
  </div>;
}
