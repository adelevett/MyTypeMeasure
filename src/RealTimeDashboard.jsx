// Original implementation for Dual-Axis Keystroke Analyzer
// Extends data structures from FlexKeyLogger by Terry Y. Tian

import React, { useState, useMemo, useEffect } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell } from 'recharts';
import { extractMetrics, calculateDualAxis, getCalibrationData, DEFAULT_WEIGHTS } from './analyzer';

const RealTimeDashboard = ({ keylog, scoringMode, onCalibStatusChange }) => {
    const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
    const [showVisual, setShowVisual] = useState(true);

    // Compute metrics and score whenever keylog or weights change
    const { metrics, dualAxis, calibStatus } = useMemo(() => {
        if (!keylog || !keylog.EventID || keylog.EventID.length < 2) {
            return { metrics: null, dualAxis: null, calibStatus: "Waiting for input..." };
        }
        const extracted = extractMetrics(keylog);

        let currentCalibData = null;
        let currentCalibStatus = "Not using calibration.";

        if (scoringMode === "calibrated") {
            const calib = getCalibrationData(keylog);
            if (calib) {
                currentCalibData = calib;
                currentCalibStatus = "Calibration complete.";
            } else {
                currentCalibStatus = `Warming up... (${extracted.finalLength}/200 chars for baseline)`;
            }
        }

        const calculated = calculateDualAxis(extracted, weights, currentCalibData);
        return { metrics: extracted, dualAxis: calculated, calibStatus: currentCalibStatus };
    }, [keylog, weights, scoringMode]);

    useEffect(() => {
        if (onCalibStatusChange) {
            onCalibStatusChange(calibStatus);
        }
    }, [calibStatus, onCalibStatusChange]);

    if (!metrics || !dualAxis) {
        return (
            <div className="dashboard-container placeholder">
                Start typing to generate real-time cognitive metrics...
            </div>
        );
    }

    const chartData = [{
        x: dualAxis.linearityScore,
        y: dualAxis.spontaneityScore,
    }];

    // Handlers for sliders
    const handleGroupWeightChange = (group, value) => {
        setWeights(prev => ({
            ...prev,
            groups: {
                ...prev.groups,
                [group]: parseFloat(value)
            }
        }));
    };

    const handleSubWeightChange = (category, field, value) => {
        setWeights(prev => ({
            ...prev,
            [category]: {
                ...prev[category],
                [field]: parseFloat(value)
            }
        }));
    };

    return (
        <div className="dashboard-container" style={{ padding: '20px', backgroundColor: '#f9fafb', borderRadius: '8px', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem', color: '#111827' }}>Keystroke Analyzer</h2>
                <button
                    onClick={() => setShowVisual(!showVisual)}
                    style={{ padding: '8px 16px', backgroundColor: '#e5e7eb', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                >
                    Toggle {showVisual ? 'Text' : 'Visual'} View
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                {/* Left Side: Visualization / Text Mode */}
                <div style={{ flex: 2, backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    {showVisual ? (
                        <div style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <h3 style={{ textAlign: 'center', margin: 0, marginBottom: '10px' }}>Linear & Free-Wheeling Quadrants</h3>
                            <ResponsiveContainer width="100%" height="100%">
                                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" dataKey="x" name="Linear" domain={[0, 100]} label={{ value: 'Linear \u2192', position: 'bottom' }} />
                                    <YAxis type="number" dataKey="y" name="Free-Wheeling" domain={[0, 100]} label={{ value: 'Free-Wheeling \u2192', angle: -90, position: 'insideLeft' }} />
                                    <Tooltip cursor={{ strokeDasharray: '3 3' }} formatter={(val, name) => [val.toFixed(1), name]} />
                                    <ReferenceLine x={50} stroke="#9ca3af" />
                                    <ReferenceLine y={50} stroke="#9ca3af" />
                                    <Scatter name="Session" data={chartData} fill="#3b82f6">
                                        {chartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill="#3b82f6" />
                                        ))}
                                    </Scatter>
                                </ScatterChart>
                            </ResponsiveContainer>
                            <div style={{ textAlign: 'center', marginTop: '10px', fontWeight: 600 }}>
                                Score: [Linear: {dualAxis.linearityScore.toFixed(1)}, Free-Wheeling: {dualAxis.spontaneityScore.toFixed(1)}]
                            </div>
                        </div>
                    ) : (
                        <div>
                            <h3>Analysis Details (Text Mode)</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div>
                                    <h4>Composite Scores</h4>
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        <li><strong>Linear:</strong> {dualAxis.linearityScore.toFixed(1)} / 100</li>
                                        <li><strong>Free-Wheeling:</strong> {dualAxis.spontaneityScore.toFixed(1)} / 100</li>
                                    </ul>
                                    <h4>Individual Components</h4>
                                    <ul style={{ listStyle: 'none', padding: 0 }}>
                                        <li><strong>Path Shape:</strong> {dualAxis.components.pathShape.toFixed(2)}</li>
                                        <li><strong>Revision Activity:</strong> {dualAxis.components.revBase.toFixed(2)}</li>
                                        <li><strong>Fluency:</strong> {dualAxis.components.fluencyBase.toFixed(2)}</li>
                                        <li><strong>Pause Behavior:</strong> {dualAxis.components.pbBase.toFixed(2)}</li>
                                        <li><strong>Paste Contribution:</strong> {dualAxis.components.pasteScore.toFixed(2)}</li>
                                    </ul>
                                </div>
                                <div>
                                    <h4>Raw Keystroke Metrics</h4>
                                    <ul style={{ listStyle: 'none', padding: 0, fontSize: '0.9rem' }}>
                                        <li><strong>Events:</strong> {metrics.totalEvents}</li>
                                        <li><strong>Chars/Min:</strong> {metrics.characters_per_minute.toFixed(1)}</li>
                                        <li><strong>Product/Process Ratio:</strong> {metrics.product_process_ratio.toFixed(2)}</li>
                                        <li><strong>Revisions:</strong> {metrics.num_revisions}</li>
                                        <li><strong>Insertions:</strong> {metrics.num_insertions}</li>
                                        <li><strong>Deletions:</strong> {metrics.num_deletions}</li>
                                        <li><strong>Mean Pause (s):</strong> {metrics.pause_time_mean.toFixed(2)}</li>
                                        <li><strong>Pauses Before Words:</strong> {metrics.pause_before_words.toFixed(2)}</li>
                                        <li><strong>Paste Events:</strong> {metrics.paste_events}</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Side: Weight Controls & Settings */}
                <div style={{ flex: 1, backgroundColor: '#fff', padding: '15px', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflowY: 'auto', maxHeight: '1000px' }}>
                    <h3 style={{ marginTop: 0 }}>Axis Tuning</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <h4 style={{ margin: '0 0 10px 0' }}>Linear</h4>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Path Shape ({weights.groups.pathShape})</label>
                            <input type="range" min="0" max="1" step="0.05" value={weights.groups.pathShape} onChange={(e) => handleGroupWeightChange('pathShape', e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Revision Activity ({weights.groups.revisionActivity})</label>
                            <input type="range" min="0" max="1" step="0.05" value={weights.groups.revisionActivity} onChange={(e) => handleGroupWeightChange('revisionActivity', e.target.value)} style={{ width: '100%' }} />
                        </div>
                    </div>

                    <div>
                        <h4 style={{ margin: '0 0 10px 0' }}>Free-Wheeling</h4>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Fluency ({weights.groups.fluency})</label>
                            <input type="range" min="0" max="1" step="0.05" value={weights.groups.fluency} onChange={(e) => handleGroupWeightChange('fluency', e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Pause Behavior ({weights.groups.pauseBehavior})</label>
                            <input type="range" min="0" max="1" step="0.05" value={weights.groups.pauseBehavior} onChange={(e) => handleGroupWeightChange('pauseBehavior', e.target.value)} style={{ width: '100%' }} />
                        </div>
                        <div style={{ marginBottom: '15px' }}>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Paste Event Weight ({weights.paste.BASE_JUMP})</label>
                            <input type="range" min="0" max="0.5" step="0.01" value={weights.paste.BASE_JUMP} onChange={(e) => handleSubWeightChange('paste', 'BASE_JUMP', e.target.value)} style={{ width: '100%' }} />
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default RealTimeDashboard;
