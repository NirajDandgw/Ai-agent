import React, { useState } from 'react';
import '../styles/AddIncidentForm.css';

const AddIncidentForm = ({ jobDetails, onClose, onSubmit }) => {
  const [formData, setFormData] = useState({
    developerOnCall: '',
    environment: 'PROD',
    errorCode: '',
    errorPattern: jobDetails?.rca?.errorPattern || '',
    problem: '',
    rootCause: '',
    rcaDescription: '',
    resolutionSummary: '',
    resolutionSteps: ['', '', ''],
    category: 'APPLICATION',
    logExample: jobDetails?.logInsights?.errorExtracted || ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleStepChange = (index, value) => {
    const newSteps = [...formData.resolutionSteps];
    newSteps[index] = value;
    setFormData(prev => ({ ...prev, resolutionSteps: newSteps }));
  };

  const addStep = () => {
    setFormData(prev => ({
      ...prev,
      resolutionSteps: [...prev.resolutionSteps, '']
    }));
  };

  const removeStep = (index) => {
    const newSteps = formData.resolutionSteps.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, resolutionSteps: newSteps }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Generate incident ID
      const incidentsResponse = await fetch('/incidents.json');
      const incidentsData = await incidentsResponse.json();
      const incNumbers = incidentsData.incidents
        .map(inc => parseInt(inc.incidentId.replace(/[^\d]/g, '')))
        .filter(num => !isNaN(num));
      const maxNum = incNumbers.length > 0 ? Math.max(...incNumbers) : 1000;
      const newIncidentId = `INC${maxNum + 1}`;

      const now = new Date();
      const newIncident = {
        incidentId: newIncidentId,
        developerOnCall: formData.developerOnCall,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].substring(0, 5),
        environment: formData.environment,
        jobId: jobDetails.jobId || 'UNKNOWN',
        jobName: jobDetails.jobName,
        jobDescription: jobDetails.jobDescription || '',
        errorCode: formData.errorCode,
        errorPattern: formData.errorPattern,
        problem: formData.problem,
        rootCause: formData.rootCause,
        rcaDescription: formData.rcaDescription,
        resolutionSummary: formData.resolutionSummary,
        resolutionSteps: formData.resolutionSteps.filter(step => step.trim() !== ''),
        category: formData.category,
        logExample: formData.logExample,
        confidenceScore: 90
      };

      // Call the onSubmit callback
      await onSubmit(newIncident);
      
      alert(`Incident ${newIncidentId} added to knowledge base successfully!`);
      onClose();
    } catch (error) {
      alert('Failed to add incident to knowledge base: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="add-incident-overlay">
      <div className="add-incident-modal">
        <div className="modal-header">
          <h2>Add New Incident to Knowledge Base</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="incident-form">
          <div className="form-grid">
            <div className="form-group">
              <label>Developer On Call *</label>
              <input
                type="text"
                name="developerOnCall"
                value={formData.developerOnCall}
                onChange={handleChange}
                required
                placeholder="Your name"
              />
            </div>

            <div className="form-group">
              <label>Environment *</label>
              <select
                name="environment"
                value={formData.environment}
                onChange={handleChange}
                required
              >
                <option value="PROD">PROD</option>
                <option value="QA">QA</option>
                <option value="DEV">DEV</option>
              </select>
            </div>

            <div className="form-group">
              <label>Error Code *</label>
              <input
                type="text"
                name="errorCode"
                value={formData.errorCode}
                onChange={handleChange}
                required
                placeholder="e.g., DB_TIMEOUT"
              />
            </div>

            <div className="form-group">
              <label>Error Pattern *</label>
              <input
                type="text"
                name="errorPattern"
                value={formData.errorPattern}
                onChange={handleChange}
                required
                placeholder="e.g., Connection timeout"
              />
            </div>

            <div className="form-group">
              <label>Category *</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange}
                required
              >
                <option value="DB">Database</option>
                <option value="FILE">File</option>
                <option value="INFRA">Infrastructure</option>
                <option value="APPLICATION">Application</option>
              </select>
            </div>
          </div>

          <div className="form-group full-width">
            <label>Problem Description *</label>
            <input
              type="text"
              name="problem"
              value={formData.problem}
              onChange={handleChange}
              required
              placeholder="Brief problem description"
            />
          </div>

          <div className="form-group full-width">
            <label>Root Cause *</label>
            <input
              type="text"
              name="rootCause"
              value={formData.rootCause}
              onChange={handleChange}
              required
              placeholder="Root cause of the failure"
            />
          </div>

          <div className="form-group full-width">
            <label>RCA Description *</label>
            <textarea
              name="rcaDescription"
              value={formData.rcaDescription}
              onChange={handleChange}
              required
              rows="4"
              placeholder="Detailed root cause analysis description..."
            />
          </div>

          <div className="form-group full-width">
            <label>Resolution Summary *</label>
            <input
              type="text"
              name="resolutionSummary"
              value={formData.resolutionSummary}
              onChange={handleChange}
              required
              placeholder="Brief resolution summary"
            />
          </div>

          <div className="form-group full-width">
            <label>Resolution Steps *</label>
            {formData.resolutionSteps.map((step, index) => (
              <div key={index} className="step-input-group">
                <span className="step-number">{index + 1}</span>
                <input
                  type="text"
                  value={step}
                  onChange={(e) => handleStepChange(index, e.target.value)}
                  placeholder={`Step ${index + 1}`}
                  required={index < 3}
                />
                {formData.resolutionSteps.length > 3 && (
                  <button
                    type="button"
                    className="remove-step-btn"
                    onClick={() => removeStep(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            <button type="button" className="add-step-btn" onClick={addStep}>
              + Add Step
            </button>
          </div>

          <div className="form-group full-width">
            <label>Log Example</label>
            <textarea
              name="logExample"
              value={formData.logExample}
              onChange={handleChange}
              rows="3"
              placeholder="Paste the actual error log message..."
            />
          </div>

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add to Knowledge Base'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddIncidentForm;