'use client';

import { useState, useEffect } from 'react';

interface ColumnMappingInterfaceProps {
  headers: string[];
  detectedMappings?: Record<string, string>;
  onMappingChange: (mappings: Record<string, string>) => void;
  onComplete: () => void;
  onCancel: () => void;
  className?: string;
}

const TARGET_FIELDS = [
  { value: 'keyword', label: 'Keyword (Required)', required: true },
  { value: 'searchVolume', label: 'Search Volume', required: false },
  { value: 'difficulty', label: 'Keyword Difficulty', required: false },
  { value: 'cpc', label: 'Cost Per Click', required: false },
  { value: 'competition', label: 'Competition Level', required: false },
  { value: 'competitionIndex', label: 'Competition Index', required: false },
  { value: 'position', label: 'Position', required: false },
  { value: 'previousPosition', label: 'Previous Position', required: false },
  { value: 'results', label: 'Search Results', required: false },
  { value: 'intent', label: 'Search Intent', required: false },
  { value: 'serpFeatures', label: 'SERP Features', required: false },
  { value: 'parentTopic', label: 'Parent Topic', required: false },
  { value: 'trafficPotential', label: 'Traffic Potential', required: false },
  { value: 'returnRate', label: 'Return Rate', required: false },
  { value: 'clicks', label: 'Clicks', required: false },
  { value: 'topBidLow', label: 'Top Bid (Low)', required: false },
  { value: 'topBidHigh', label: 'Top Bid (High)', required: false },
  { value: 'ignore', label: 'Ignore Column', required: false }
];

export default function ColumnMappingInterface({
  headers,
  detectedMappings = {},
  onMappingChange,
  onComplete,
  onCancel,
  className = ''
}: ColumnMappingInterfaceProps) {
  const [mappings, setMappings] = useState<Record<string, string>>(detectedMappings);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    setMappings(detectedMappings);
  }, [detectedMappings]);

  const handleMappingChange = (header: string, targetField: string) => {
    const newMappings = {
      ...mappings,
      [header]: targetField
    };
    setMappings(newMappings);
    onMappingChange(newMappings);
  };

  const validateMappings = (): string[] => {
    const validationErrors: string[] = [];

    // Check if keyword mapping is present
    const hasKeywordMapping = Object.values(mappings).includes('keyword');
    if (!hasKeywordMapping) {
      validationErrors.push('Keyword column mapping is required');
    }

    // Check for duplicate mappings (except 'ignore')
    const usedTargets: Record<string, string[]> = {};
    Object.entries(mappings).forEach(([header, target]) => {
      if (target && target !== 'ignore') {
        if (!usedTargets[target]) {
          usedTargets[target] = [];
        }
        usedTargets[target].push(header);
      }
    });

    Object.entries(usedTargets).forEach(([target, headers]) => {
      if (headers.length > 1) {
        validationErrors.push(`Multiple columns mapped to ${target}: ${headers.join(', ')}`);
      }
    });

    return validationErrors;
  };

  const handleComplete = () => {
    const validationErrors = validateMappings();
    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      return;
    }

    setErrors([]);
    onComplete();
  };

  const getAvailableTargets = (currentHeader: string): typeof TARGET_FIELDS => {
    const currentMapping = mappings[currentHeader];

    return TARGET_FIELDS.filter(field => {
      // Always show the currently selected option
      if (field.value === currentMapping) {
        return true;
      }

      // Always show 'ignore' option
      if (field.value === 'ignore') {
        return true;
      }

      // Don't show targets that are already mapped by other columns
      const isAlreadyMapped = Object.entries(mappings).some(
        ([header, target]) => header !== currentHeader && target === field.value
      );

      return !isAlreadyMapped;
    });
  };

  const getMappedTargetLabel = (targetValue: string): string => {
    const target = TARGET_FIELDS.find(f => f.value === targetValue);
    return target ? target.label : targetValue;
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Map CSV Columns
        </h3>
        <p className="text-sm text-gray-600">
          Map your CSV columns to the appropriate keyword data fields. At minimum, you must map a keyword column.
        </p>
      </div>

      {/* Error Messages */}
      {errors.length > 0 && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <h4 className="text-sm font-medium text-red-800 mb-2">Please fix the following errors:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {errors.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Column Mappings */}
      <div className="space-y-4 mb-6">
        {headers.map((header, index) => (
          <div key={index} className="flex items-center space-x-4 p-4 bg-gray-50 rounded-md">
            {/* CSV Column */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                CSV Column
              </label>
              <div className="px-3 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-900">
                {header}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex-shrink-0 mt-6">
              <svg className="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>

            {/* Target Field */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maps to
              </label>
              <select
                value={mappings[header] || ''}
                onChange={(e) => handleMappingChange(header, e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
              >
                <option value="">Select field...</option>
                {getAvailableTargets(header).map((field) => (
                  <option key={field.value} value={field.value}>
                    {field.label} {field.required ? '*' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Mapping Summary */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Mapping Summary</h4>
        <div className="text-sm text-blue-700 space-y-1">
          {Object.entries(mappings).filter(([, target]) => target && target !== 'ignore').map(([header, target]) => (
            <div key={header} className="flex justify-between">
              <span className="font-medium">{header}</span>
              <span>→ {getMappedTargetLabel(target)}</span>
            </div>
          ))}
          {Object.keys(mappings).filter(header => !mappings[header] || mappings[header] === 'ignore').length > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-300">
              <span className="text-xs text-blue-600">
                Unmapped columns: {Object.keys(mappings).filter(header => !mappings[header] || mappings[header] === 'ignore').join(', ')}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md font-medium"
        >
          Cancel
        </button>
        <button
          onClick={handleComplete}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium"
        >
          Apply Mapping
        </button>
      </div>

      {/* Help Text */}
      <div className="mt-4 text-xs text-gray-500">
        <p>* Required fields must be mapped for the import to proceed.</p>
        <p>Columns mapped to "Ignore" will not be imported.</p>
      </div>
    </div>
  );
}