// Based on FlexKeyLogger by Terry Y. Tian
// https://github.com/terryyutian/keylogging-demo-webpage
// MIT License — original copyright retained

import { useRef, useState } from "react";
import "./App.css";
import { useFlexKeyLogger } from "./FlexKeyLogger";
import RealTimeDashboard from "./RealTimeDashboard";
import { extractMetrics, calculateDualAxis, DEFAULT_WEIGHTS } from "./analyzer";

const ExampleApp = () => {
  const textAreaRef = useRef(null);
  const submitButtonRef = useRef(null);
  const downloadcsvRef = useRef(null);
  const downloadidfxRef = useRef(null);
  const downloadtextRef = useRef(null);

  const [isSubmitClicked, setIsSubmitClicked] = useState(false);
  const [keylogData, setKeylogData] = useState(null);
  const [scoringMode, setScoringMode] = useState("standard");
  const [calibStatus, setCalibStatus] = useState("Waiting for input...");

  const handleDownloadReport = () => {
    if (!keylogData) return;
    const extracted = extractMetrics(keylogData);
    const result = calculateDualAxis(extracted, DEFAULT_WEIGHTS);
    const reportData = {
      attribution: {
        logging_infrastructure: "FlexKeyLogger by Terry Y. Tian (MIT License)",
        benchmarks: "Based on Crossley et al. / Vanderbilt EDM 2024"
      },
      finalText: keylogData.FinalProduct,
      metrics: extracted,
      analysis: result
    };
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `analysis_report_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const handleButtonClick = () => {
    setIsSubmitClicked(true);
  };

  useFlexKeyLogger({
    textAreaRef,
    submitButtonRef,
    downloadcsvRef,
    downloadidfxRef,
    downloadtextRef,
    onUpdate: setKeylogData,
  });
  return (
    <div className="app-container">
      <div className="instruction-area">
        <p className="title">
          <strong>Instructions</strong>
        </p>
        <p>
          This tool combines FlexKeyLogger — a web-based keystroke logging program by Yu Tian — with a real-time writing process analyzer. As you type, your keystrokes are recorded and used to generate two descriptive scores: Linear (how directly your text was composed) and Free-Wheeling (how unconstrained your writing process was).
        </p>
        <p>
          Since these metrics don&apos;t fully isolate from typing skill, consider choosing a scoring mode below. In Calibrated mode, your first 200 characters establish a personal typing baseline before scoring begins.
        </p>
        <p>
          When you finish, click <i>Download Report</i> to download your keystroke data as CSV or IDFX. IDFX files can be analyzed further in <a href="https://www.inputlog.net/">Inputlog9</a>. A JSON report including your dual-axis scores is also available.
        </p>
        <p>
          Keystroke activity outside the text area is not recorded.
        </p>

        <div style={{ marginTop: '25px', padding: '15px', backgroundColor: '#f3f4f6', borderRadius: '6px', color: '#111827' }}>
          <p style={{ margin: '0 0 10px 0', fontSize: '0.85rem', color: '#4b5563' }}>
            <em>Note: Both axes are influenced by typing proficiency independent of writing process.</em>
          </p>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '1rem' }}>Scoring mode</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.85rem' }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="radio"
                name="scoringMode"
                value="standard"
                checked={scoringMode === 'standard'}
                onChange={() => setScoringMode('standard')}
                style={{ marginTop: '2px', marginRight: '8px' }}
              />
              <div>
                <strong>Standard</strong> — scores normalized against the KLiCKe corpus (<a href="https://files.eric.ed.gov/fulltext/ED675615.pdf" target="_blank" rel="noreferrer" style={{ color: '#3b82f6' }}>Tian et al. 2025</a>), a population of ~5,000 adult writers.
              </div>
            </label>
            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer' }}>
              <input
                type="radio"
                name="scoringMode"
                value="calibrated"
                checked={scoringMode === 'calibrated'}
                onChange={() => setScoringMode('calibrated')}
                style={{ marginTop: '2px', marginRight: '8px' }}
              />
              <div>
                <strong>Calibrated</strong> <em>(experimental)</em> — your first 200 characters establish a personal typing baseline to isolate process from motor skill.
                {scoringMode === 'calibrated' && (
                  <div style={{ marginTop: '5px', color: '#059669', fontWeight: 600 }}>Status: {calibStatus}</div>
                )}
              </div>
            </label>
          </div>
        </div>

        <div style={{ marginTop: '30px', padding: '15px', borderTop: '1px solid #e5e7eb', textAlign: 'left', fontSize: '0.85rem', color: '#6b7280' }}>
          <p style={{ margin: '0 0 10px 0' }}>
            This project builds on <a href="https://github.com/terryyutian/keylogging-demo-webpage" target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none' }}>FlexKeyLogger</a> by Yu Tian (MIT License). Benchmark statistics are drawn from Crossley, Tian et al. (EDM 2024), based on the KLiCKe Corpus. The Linear/Free-Wheeling dual-axis framework — which reinterprets these metrics descriptively rather than normatively — is original to this project and is not proposed or endorsed by the original authors.
          </p>
          <details style={{ backgroundColor: '#fff', padding: '10px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Citations & BibTeX</summary>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.75rem', marginTop: '10px', overflowX: 'auto', color: '#374151', fontFamily: 'monospace' }}>
              {`@article{tian2025klicke,
  author    = {Tian, Yu and Crossley, Scott and Van Waes, Luuk},
  title     = {The {KLiCKe} Corpus: Keystroke Logging in Compositions for Knowledge Evaluation},
  journal   = {Journal of Writing Research},
  year      = {2025},
  volume    = {17},
  number    = {1},
  pages     = {23--60},
  doi       = {10.17239/jowr-2025.17.01.02}
}

@inproceedings{crossley2024plagiarism,
  author    = {Crossley, Scott and Tian, Yu and Choi, Joon Suh and Holmes, Langdon and Morris, Wesley},
  title     = {Plagiarism Detection Using Keystroke Logs},
  booktitle = {Proceedings of the 17th International Conference on Educational Data Mining},
  year      = {2024},
  pages     = {476--483},
  address   = {Atlanta, Georgia, USA},
  publisher = {International Educational Data Mining Society},
  doi       = {10.5281/zenodo.12729864}
}

@misc{tian2024flexkeylogger,
  author    = {Tian, Yu},
  title     = {keylogging-demo-webpage: A Web-Based Keystroke Logging Demo Application},
  year      = {2024},
  publisher = {GitHub},
  howpublished = {\\url{https://github.com/terryyutian/keylogging-demo-webpage}},
  note      = {MIT License}
}`}
            </pre>
          </details>
        </div>
      </div>

      <div className="main-area">
        {" "}
        {/* Right side */}
        <textarea
          ref={textAreaRef}
          className="text-area"
          spellCheck="false"
          placeholder="Start composing"
        ></textarea>

        <div style={{ marginTop: '20px', width: '100%' }}>
          <RealTimeDashboard keylog={keylogData} scoringMode={scoringMode} onCalibStatusChange={setCalibStatus} />
        </div>

        <div className="buttons-container">
          <div className="download-buttons">
            <button
              ref={submitButtonRef}
              onClick={handleButtonClick}
              style={{ visibility: isSubmitClicked ? "hidden" : "visible" }}
            >
              Download Report
            </button>
          </div>
          <div className="download-buttons">
            <button
              style={{ visibility: isSubmitClicked ? "visible" : "hidden" }}
              className="download-button"
              ref={downloadcsvRef}
            >
              Download as CSV
            </button>
            <button
              style={{ visibility: isSubmitClicked ? "visible" : "hidden" }}
              className="download-button"
              ref={downloadidfxRef}
            >
              Download as IDFX
            </button>
            <button
              style={{ visibility: isSubmitClicked ? "visible" : "hidden" }}
              className="download-button"
              ref={downloadtextRef}
            >
              Download Final Text
            </button>
            <button
              style={{ visibility: isSubmitClicked ? "visible" : "hidden" }}
              className="download-button"
              onClick={handleDownloadReport}
            >
              Download JSON Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExampleApp;
