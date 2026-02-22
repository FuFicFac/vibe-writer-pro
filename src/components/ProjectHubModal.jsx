import React from 'react';
import { FolderOpen, Plus, X } from 'lucide-react';
import clsx from 'clsx';

export default function ProjectHubModal({ isOpen, onClose, projects, activeProjectId, onOpenProject, onCreateProject }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#001024]/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="w-full max-w-4xl max-h-[86vh] overflow-hidden rounded-xl border border-[#001024] bg-seahawks-navy shadow-2xl flex flex-col">
        <div className="px-6 py-4 border-b border-[#001024] flex items-center justify-between bg-seahawks-navy/60">
          <div>
            <h2 className="text-white font-bold text-xl flex items-center gap-2">
              <FolderOpen size={18} className="text-seahawks-green" />
              Project Hub
            </h2>
            <p className="text-sm text-seahawks-gray mt-1">
              View all projects and jump between them.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onCreateProject}
              className="px-3 py-2 rounded-md text-sm font-medium bg-seahawks-green/10 text-seahawks-green border border-seahawks-green/30 hover:bg-seahawks-green hover:text-[#001024] transition-colors flex items-center gap-1.5"
              title="Create Project"
            >
              <Plus size={14} />
              New Project
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-md text-seahawks-gray hover:text-white hover:bg-[#001730] transition-colors flex items-center justify-center"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          {projects.length === 0 ? (
            <div className="rounded-lg border border-seahawks-gray/10 bg-[#001730] p-6 text-center text-seahawks-gray">
              No projects yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((project) => {
                const isActive = project.id === activeProjectId;
                return (
                  <button
                    key={project.id}
                    onClick={() => onOpenProject(project.id)}
                    className={clsx(
                      'text-left rounded-xl border p-4 transition-all shadow-sm',
                      isActive
                        ? 'border-seahawks-green/40 bg-seahawks-green/5'
                        : 'border-seahawks-gray/10 bg-[#001730] hover:border-seahawks-gray/30 hover:bg-[#001730]/80'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={clsx('font-semibold truncate', isActive ? 'text-seahawks-green' : 'text-white')}>
                          {project.name}
                        </div>
                        <div className="text-xs text-seahawks-gray mt-1">
                          Created {formatProjectDate(project.createdAt)}
                        </div>
                        <div className="text-xs text-seahawks-gray/80 mt-0.5">
                          Updated {formatProjectDate(project.updatedAt)}
                        </div>
                      </div>
                      {isActive && (
                        <span className="text-[10px] px-2 py-1 rounded border border-seahawks-green/30 bg-seahawks-green/10 text-seahawks-green font-bold uppercase tracking-wide shrink-0">
                          Current
                        </span>
                      )}
                    </div>
                    <div className="mt-4 text-xs text-seahawks-gray">
                      Click to open this project
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatProjectDate(value) {
  if (!value) return 'unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'unknown';
  return date.toLocaleString();
}
