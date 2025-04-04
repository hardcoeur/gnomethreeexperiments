console.log("viewer.js loaded"); // Add log message

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';

let scene, camera, renderer;
let cube; // Initial cube
let orbitControls, transformControls;
let raycaster, pointer; // For selection
let highlightMesh = null; // Mesh used to highlight selected face
let selectedFaceIndex = null; // Index of the currently selected face

const selectableObjects = []; // Array to hold objects that can be selected/transformed

function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x333333); // Dark grey background

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 5;

    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    // Geometry (a simple cube)
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0x0077ff }); // Blue color
    cube = new THREE.Mesh(geometry, material);
    scene.add(cube);
    selectableObjects.push(cube); // Add initial cube to selectable list

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5); // Soft white light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(1, 1, 1).normalize();
    scene.add(directionalLight);

    // Controls
    orbitControls = new OrbitControls(camera, renderer.domElement);
    orbitControls.enableDamping = true; // Optional damping

    transformControls = new TransformControls(camera, renderer.domElement);

    // --- Snapping ---
    // Set initial snap values (can be toggled later) - Increase translation snap for testing
    transformControls.translationSnap = 5.0; // Snap to 5 unit grid
    transformControls.rotationSnap = Math.PI / 12; // Snap to 15 degrees
    transformControls.scaleSnap = 0.1; // Snap to 0.1 increments

    // --- Event Listeners for Controls ---
    transformControls.addEventListener('dragging-changed', function (event) {
        // Disable orbit controls while transforming
        orbitControls.enabled = !event.value;
    });

    // TODO: Add listeners to toggle snapping based on modifier keys (e.g., Shift)
    scene.add(transformControls);

    // Raycaster setup
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    // Event Listeners
    window.addEventListener('resize', onWindowResize, false);
    // Use pointerdown for interaction start
    renderer.domElement.addEventListener('pointerdown', onPointerDown, false);


    // Start animation loop
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    // Update controls
    orbitControls.update(); // Only required if enableDamping or autoRotate are set

    // Update highlight mesh if it exists
    // (Position/orientation update might be needed if object moves independently)
    // updateHighlight(); // Call this later when highlight is created

    // Simple animation: rotate the initial cube if not being transformed
    if (cube && !transformControls.object) { // Check if transformControls is attached
         cube.rotation.x += 0.01;
         cube.rotation.y += 0.01;
    }

    renderer.render(scene, camera);
}

// --- Interaction ---

function onPointerDown(event) {
    console.log("onPointerDown triggered");

    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // Simplified Logic: Raycast against selectable objects only
    const intersectsObjects = raycaster.intersectObjects(selectableObjects, false);
    console.log(`Object intersects: ${intersectsObjects.length}`);

    if (intersectsObjects.length > 0) {
        // Clicked an object
        const intersection = intersectsObjects[0]; // Get the full intersection object
        const object = intersection.object;
        const faceIdx = intersection.faceIndex;
        console.log("Clicked on object:", object.uuid, "Face index:", faceIdx);

        selectedFaceIndex = faceIdx; // Store selected face index

        // Attach controls if a transform tool is active and not already attached
        if ((activeTool === 'move' || activeTool === 'rotate' || activeTool === 'scale')) {
            if (transformControls.object !== object) {
                 console.log("Attaching controls...");
                 transformControls.attach(object);
                 console.log("Attached transform controls to:", object.uuid);
                 setActiveTool(activeTool); // Re-apply tool settings (enables controls)
            } else {
                 console.log("Clicked object already attached.");
            }
             createOrUpdateHighlight(); // Update highlight for the newly selected face/object
        } else if (activeTool === 'select') {
             // If select tool is active, detach controls but keep face selected
             if (transformControls.object) {
                 console.log("Select tool active, detaching controls...");
                 transformControls.detach();
                 console.log("Detached transform controls");
                 setActiveTool(activeTool); // Re-apply tool settings (disables controls)
             }
             createOrUpdateHighlight(); // Update highlight for the newly selected face/object
        } else {
             console.log(`Tool is ${activeTool}, no transform action on object click.`);
             selectedFaceIndex = null; // Deselect face if tool doesn't support selection
             removeHighlight();
        }

    } else {
        // Clicked empty space
        console.log("Clicked on empty space.");
        selectedFaceIndex = null; // Deselect face
        removeHighlight(); // Remove highlight
        if (transformControls.object) {
            console.log("Detaching controls...");
            transformControls.detach();
            console.log("Detached transform controls");
            setActiveTool(activeTool); // Re-apply tool settings (disables controls)
        }
    }
    console.log("onPointerDown finished");
}


// --- Highlighting ---

function createOrUpdateHighlight() {
    console.log("Attempting to create/update highlight");
    removeHighlight(); // Remove previous highlight first

    const object = transformControls.object; // Get currently attached object
    if (!object || selectedFaceIndex === null) {
        console.log("No object attached or face selected, cannot highlight.");
        return;
    }

    console.log(`Highlighting face ${selectedFaceIndex} on object ${object.uuid}`);

    const geometry = object.geometry;
    const faceNormalAttribute = geometry.attributes.normal;
    const indexAttribute = geometry.index;
    const positionAttribute = geometry.attributes.position;

    if (!geometry || !indexAttribute || !positionAttribute || !faceNormalAttribute) {
        console.error("Highlight Error: Geometry data missing or invalid (index, position, or normal).");
        return;
    }

    const indices = indexAttribute.array;
    const positions = positionAttribute.array;
    const normals = faceNormalAttribute.array; // Assuming per-vertex normals

    // --- Find adjacent triangle for quad face ---
    let adjacentFaceIndex = -1;
    const selectedNormal = new THREE.Vector3(); // Normal of the selected face
    const tempNormal = new THREE.Vector3();    // Normal of the potential adjacent face
    const tolerance = 0.001;                   // Tolerance for normal comparison

    // Get normal of selected face (average of its vertex normals)
    const i1 = indices[selectedFaceIndex * 3];
    const i2 = indices[selectedFaceIndex * 3 + 1];
    const i3 = indices[selectedFaceIndex * 3 + 2];
    const n1 = new THREE.Vector3(normals[i1 * 3], normals[i1 * 3 + 1], normals[i1 * 3 + 2]);
    const n2 = new THREE.Vector3(normals[i2 * 3], normals[i2 * 3 + 1], normals[i2 * 3 + 2]);
    const n3 = new THREE.Vector3(normals[i3 * 3], normals[i3 * 3 + 1], normals[i3 * 3 + 2]);
    selectedNormal.addVectors(n1, n2).add(n3).normalize();

    // Check potential adjacent face index (works for standard BoxGeometry)
    const potentialAdjacentIndex = (selectedFaceIndex % 2 === 0) ? selectedFaceIndex + 1 : selectedFaceIndex - 1;

    if (potentialAdjacentIndex >= 0 && (potentialAdjacentIndex * 3 + 2) < indices.length) { // Check bounds
        // Get normal of potential adjacent face
        const j1 = indices[potentialAdjacentIndex * 3];
        const j2 = indices[potentialAdjacentIndex * 3 + 1];
        const j3 = indices[potentialAdjacentIndex * 3 + 2];
        const m1 = new THREE.Vector3(normals[j1 * 3], normals[j1 * 3 + 1], normals[j1 * 3 + 2]);
        const m2 = new THREE.Vector3(normals[j2 * 3], normals[j2 * 3 + 1], normals[j2 * 3 + 2]);
        const m3 = new THREE.Vector3(normals[j3 * 3], normals[j3 * 3 + 1], normals[j3 * 3 + 2]);
        tempNormal.addVectors(m1, m2).add(m3).normalize();

        // Compare normals
        if (selectedNormal.distanceToSquared(tempNormal) < tolerance) {
            adjacentFaceIndex = potentialAdjacentIndex;
            console.log(`Found adjacent face: ${adjacentFaceIndex}`);
        } else {
             console.log(`Normals differ significantly, not adjacent. Sel: ${selectedNormal.toArray()}, Pot: ${tempNormal.toArray()}`);
        }
    } else {
        console.log("Potential adjacent index out of bounds or invalid.");
    }
    // --- END Find adjacent triangle ---


    // --- Create highlight geometry (one or two triangles) ---
    const highlightIndices = [i1, i2, i3];
    if (adjacentFaceIndex !== -1) {
        // Ensure we use the correct indices for the second triangle
        highlightIndices.push(indices[adjacentFaceIndex * 3], indices[adjacentFaceIndex * 3 + 1], indices[adjacentFaceIndex * 3 + 2]);
    }

    const highlightVertices = new Float32Array(highlightIndices.length * 3);
    for (let i = 0; i < highlightIndices.length; i++) {
        const index = highlightIndices[i];
        // Check if index is valid before accessing positions
        if (index * 3 + 2 < positions.length) {
            highlightVertices[i * 3] = positions[index * 3];
            highlightVertices[i * 3 + 1] = positions[index * 3 + 1];
            highlightVertices[i * 3 + 2] = positions[index * 3 + 2];
        } else {
            console.error(`Highlight Error: Vertex index ${index} out of bounds for position attribute.`);
            return; // Stop if index is invalid
        }
    }

    const highlightGeometry = new THREE.BufferGeometry();
    highlightGeometry.setAttribute('position', new THREE.BufferAttribute(highlightVertices, 3));
    // Recreate indices for the highlight geometry if we have two triangles
    if (adjacentFaceIndex !== -1) {
         // Indices need to refer to the order in highlightVertices (0, 1, 2, 3, 4, 5)
         highlightGeometry.setIndex([0, 1, 2, 3, 4, 5]);
    } else {
         highlightGeometry.setIndex([0, 1, 2]); // Indices for the 3 vertices
    }
    // --- END Create highlight geometry ---


    // --- Create highlight material and mesh ---
    const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00, // Yellow
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.5,
        depthTest: false // Render on top slightly
    });

    highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);

    // Position and orient the highlight mesh to match the object
    highlightMesh.position.copy(object.position);
    highlightMesh.rotation.copy(object.rotation);
    highlightMesh.scale.copy(object.scale);

    // Add a very small offset along the face normal (use selectedNormal calculated earlier)
    highlightMesh.position.addScaledVector(selectedNormal, 0.01); // Small offset
    // --- END Create highlight material and mesh ---


    scene.add(highlightMesh);
    console.log("Highlight mesh added.");
}

function removeHighlight() {
    if (highlightMesh) {
        scene.remove(highlightMesh);
        highlightMesh.geometry.dispose();
        highlightMesh.material.dispose();
        highlightMesh = null;
        console.log("Highlight mesh removed.");
    }
}

// Initialize the viewer
init();

// --- API for GTK Communication ---

// Store the currently active tool
let activeTool = 'select'; // Default tool

function setActiveTool(toolName) {
    activeTool = toolName;
    console.log(`Tool changed to: ${activeTool}`);

    // Reset transform controls visibility/mode
    transformControls.showX = true;
    transformControls.showY = true;
    transformControls.showZ = true;
    transformControls.enabled = true; // Ensure controls are generally enabled

    switch (activeTool) {
        case 'select':
            orbitControls.enabled = true; // Enable camera movement
            transformControls.enabled = false; // Disable gizmo for pure selection
            // Optionally detach if needed, though clicking empty space handles this
            // if (transformControls.object) transformControls.detach();
            break;
        case 'move':
            orbitControls.enabled = true; // Still allow camera movement
            transformControls.setMode('translate');
            transformControls.enabled = true;
            break;
        case 'rotate':
            orbitControls.enabled = true;
            transformControls.setMode('rotate');
            transformControls.enabled = true;
            break;
        case 'scale':
            orbitControls.enabled = true;
            transformControls.setMode('scale');
            transformControls.enabled = true;
            break;
        default:
             orbitControls.enabled = true;
             transformControls.enabled = false; // Disable if unknown tool
             if (transformControls.object) transformControls.detach();
             break;
    }
    // Hide gizmo if no object is selected, even if a transform tool is active
    if (!transformControls.object) {
        transformControls.enabled = false;
    }
}

function addCube() {
    console.log("addCube called from GTK");
    const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8); // Slightly smaller cube
    const material = new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }); // Random color
    const newCube = new THREE.Mesh(geometry, material);

    // Position the new cube slightly offset from the last one (simple example)
    const offset = scene.children.length * 0.1; // Basic offset based on object count
    newCube.position.set(offset, offset, offset);

    scene.add(newCube);
    selectableObjects.push(newCube); // Add new cube to selectable list
    console.log("New cube added to scene");
}

// Make functions accessible globally for evaluate_javascript
window.setActiveTool = setActiveTool;
window.addCube = addCube;