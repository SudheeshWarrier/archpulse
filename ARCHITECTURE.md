# ArchPulse: Architecture Overview

## Purpose

ArchPulse is a web application designed to transform static architecture diagrams (SVG format) into dynamic, animated walkthroughs. It allows users to import diagrams, define animation steps by selecting elements (nodes and edges), customize animations, and play back the sequence to clearly communicate system flows and design.

## Key Features

*   **SVG Import**: Users can upload SVG files generated from various diagramming tools.
*   **Element Selection**: Interactive identification and selection of nodes and edges within the SVG.
*   **Animation Step Creation**: Define individual steps in the animation sequence, specifying which elements to highlight and which edges to animate.
*   **Customizable Animations**:
    *   **Node Animations**: Highlight, Fade In, Scale Up, Color Change.
    *   **Edge Animations**: Draw Path, Flow Along Path, Fade In, Pulse.
*   **Automatic Step Generation**: AI-assisted feature to suggest animation steps based on the diagram's structure.
*   **Playback Controls**: Comprehensive controls for playing, pausing, stepping through, adjusting speed, and looping animations.
*   **Theme Support**: Options for system, light, and dark themes.
*   **Save/Load Functionality**: Ability to save and load project states.

## Core Components & Hooks

*   **`src/App.tsx`**: The main application component, orchestrating the UI and managing application state.
*   **`src/components/SVGCanvas.tsx`**: Renders the SVG diagram, handles user interactions (clicking elements), and applies styling for editing and playback.
*   **`src/components/AnimationPane.tsx`**: Provides the interface for creating, editing, and reordering animation steps.
*   **`src/hooks/useProjectReducer.ts`**: Manages the application's central state using `useReducer`, including project data (SVG, elements) and animation steps.
*   **`src/hooks/usePlayback.ts`**: Handles the logic for controlling animation playback timing and state.
*   **`src/utils/autoGenerate.ts`**: Contains functions for automatically generating animation steps from the SVG.
*   **`src/utils/parseSVG.ts`**: Utility for parsing SVG content into a structured format usable by the application.
*   **`src/schema/projectSchema.ts`**: Defines the expected structure and validation for project state using Zod.
*   **`src/types/index.ts`**: Defines TypeScript interfaces and types used throughout the project.

## File Structure (src directory)

*   **`components/`**: Reusable UI components (e.g., `SVGCanvas`, `AnimationPane`, `Toolbar`, `UploadZone`).
*   **`hooks/`**: Custom React hooks (e.g., `useProjectReducer`, `usePlayback`).
*   **`schema/`**: Data validation schemas.
*   **`types/`**: TypeScript type definitions.
*   **`utils/`**: Various utility functions (parsing, generation, graph logic).
*   **`assets/`**: Static assets like the logo.
*   **`animations.css` / `styles.css`**: Global stylesheets.
