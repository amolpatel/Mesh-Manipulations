///<reference path='./typings/tsd.d.ts'/>
///<reference path="./localTypings/webglutils.d.ts"/>

/*
 * Portions of this code are
 * Copyright 2015, Blair MacIntyre.
 * 
 * Portions of this code taken from http://webglfundamentals.org, at https://github.com/greggman/webgl-fundamentals
 * and are subject to the following license.  In particular, from 
 *    http://webglfundamentals.org/webgl/webgl-less-code-more-fun.html
 *    http://webglfundamentals.org/webgl/resources/primitives.js
 * 
 * Those portions Copyright 2014, Gregg Tavares.
 * All rights reserved.
 */

import loader = require('./loader');
//import textureUtils = require('./textureUtils');
import f3d = require('./f3d');


////////////////////////////////////////////////////////////////////////////////////////////
// stats module by mrdoob (https://github.com/mrdoob/stats.js) to show the performance 
// of your graphics
var stats = new Stats();
stats.setMode( 1 ); // 0: fps, 1: ms, 2: mb

stats.domElement.style.position = 'absolute';
stats.domElement.style.right = '0px';
stats.domElement.style.top = '0px';

document.body.appendChild( stats.domElement );

////////////////////////////////////////////////////////////////////////////////////////////
// utilities
var rand = function(min: number, max?: number) {
  if (max === undefined) {
    max = min;
    min = 0;
  }
  return min + Math.random() * (max - min);
};

var randInt = function(range) {
  return Math.floor(Math.random() * range);
};

////////////////////////////////////////////////////////////////////////////////////////////
// get some of our canvas elements that we need
var canvas = <HTMLCanvasElement>document.getElementById("webgl");  
var filename = <HTMLInputElement>document.getElementById("filename");
var fileSelection = <HTMLSelectElement>document.getElementById("files");
var progressGuage = <HTMLProgressElement>document.getElementById("progress");
progressGuage.style.visibility = "hidden";

////////////////////////////////////////////////////////////////////////////////////////////
// our objects!

// when a new mesh comes in, we will process it on the next frame of the update.
// to tell the update we have a new mesh, set the newObject variable to it's data
var newObject = undefined;

// the current object being displayed
var object = undefined;

////////////////////////////////////////////////////////////////////////////////////////////
// stub's for  callbacks for the model downloader. They don't do much yet
//
// called when the mesh is successfully downloaded
var onLoad = function (mesh: loader.Mesh) {
  progressGuage.value = 100;
  progressGuage.style.visibility = "hidden";
	console.log("got a mesh: " + mesh);
  
  
  // the vertex array and the triangle array are different lengths.
  // we need to create new arrays that are not nested
  // - position: 3 entries per vertex (x, y, z)
  // - normals: 3 entries per vetex (x, y, z), the normal of the corresponding vertex 
  // - colors: 3 entries per 
  // - indices: 3 entries per triangle, each being an index into the vertex array. 
  var numVerts = mesh.v.length;
  var numTris = mesh.t.length;

  var position = [];
  var color = [];
  var normal = [];
  var indices = [];
  
  // position is coordinates of vertices in 1D array
  var populatePosition = function() {
    for(var i = 0; i < numVerts; i++){
      position.push(mesh.v[i][0], mesh.v[i][1], mesh.v[i][2]);
    }
  }
  populatePosition();
  
  var populateColor = function() {
    for (var i = 0; i < mesh.v.length; i++){
      var tempColor = chroma.hsv(rand(360), 0.5, 1);
      color.push(tempColor.rgb()[0], tempColor.rgb()[1], tempColor.rgb()[2], 255);
    } 
  }
  populateColor();
  
  // indices is index of triangle vertices in 1D array every 3rd
  var populateIndices = function() {
    for(var i = 0; i < numTris; i++){
        indices.push(mesh.t[i][0], mesh.t[i][1], mesh.t[i][2]); 
      }
  }
  populateIndices();
  
  
  // for each triangle i, get the normal by getting the coordinates and doing ab x bc
  // i is triangle number
  // function from slides
  var triangleNormal = function(i) {
    var vect_a = vec3.fromValues(position[indices[i]*3], position[indices[i]*3+1], position[indices[i]*3+2]);
    console.dir(vect_a);
    var vect_b = vec3.fromValues(position[indices[i+1]*3], position[indices[i+1]*3+1], position[indices[i+1]*3+2]);
    console.dir(vect_b);
    var vect_c = vec3.fromValues(position[indices[i+2]*3], position[indices[i+2]*3+1], position[indices[i+2]*3+2]);
    console.dir(vect_c);
    
    var vect_ab = vec3.create();
    vec3.subtract(vect_ab, vect_a, vect_b);
    
    var vect_bc = vec3.create();
    vec3.subtract(vect_bc, vect_b, vect_c)
    
    var norm_ab_ac = vec3.create();
    vec3.cross(norm_ab_ac, vect_ab, vect_bc);
    
    return norm_ab_ac;
  }
  
  var normal_tri_arr = [];
  // for each triangle, get the norm
  var computeTriNormals = function() {
    var count = 0;
    for(var i = 0; i < indices.length; i=i+3){
        normal_tri_arr[count] = triangleNormal(i);
        count++;
    }
  }
  computeTriNormals();
  
  // function from slides
  var computeVertexNormals = function() {
    for(var i = 0; i < numVerts; i++){
      normal[i] = vec3.create();
    }  
    
    for(var i = 0; i < normal_tri_arr.length; i++){
      vec3.add(normal[indices[i*3]], normal[indices[i*3]], normal_tri_arr[i]);
      vec3.add(normal[indices[i*3+1]], normal[indices[i*3+1]], normal_tri_arr[i]);
      vec3.add(normal[indices[i*3+2]], normal[indices[i*3+2]], normal_tri_arr[i]);
    }
    
    for(var i = 0; i < normal.length; i++){
      vec3.normalize(normal[i],normal[i]);
    }
    
    var tempArr = [];
    for(var i = 0; i < normal.length; i++){
      tempArr.push(normal[i][0],normal[i][1],normal[i][2]);
    }
    normal = [];
    normal = tempArr;
    
  }
  computeVertexNormals();

  
  // bb1 and bb2 are the corners of the bounding box of the object.  
  var bb1 = vec3.create();
  var bb2 = vec3.create();
  
   var find_bb1 = function() {
    var min_x = 0, min_y = 0, min_z = 0;
    for(var i = 0; i < numVerts; i++){
      min_x = Math.min(mesh.v[i][0], min_x);
      min_y = Math.min(mesh.v[i][1], min_y);
      min_z = Math.min(mesh.v[i][2], min_z);
    }
    bb1 = vec3.fromValues(min_x, min_y, min_z);
  }
  find_bb1();
  
  var find_bb2 = function() {
    var max_x = 0, max_y = 0, max_z = 0;
    for(var i = 0; i < numVerts; i++){
      max_x = Math.max(mesh.v[i][0], max_x);
      max_y = Math.max(mesh.v[i][1], max_y);
      max_z = Math.max(mesh.v[i][2], max_z);
    }
    bb2 = vec3.fromValues(max_x, max_y, max_z);
  }
  find_bb2();
  
  var center_bb1_bb2 = vec3.create();
  vec3.add(center_bb1_bb2, bb2, bb1);
  vec3.scale(center_bb1_bb2, center_bb1_bb2, .5);
  
  // Setup the new object.  you can add more data to this object if you like
  // to help with subdivision (for example)
  newObject = {
    boundingBox: [bb1, bb2],
    scaleFactor: 300/vec3.distance(bb1,bb2),  
    center: center_bb1_bb2,
    numElements: indices.length,
    indices: indices,
    vertices: mesh.v,
    numTris: numTris,
    nv: numVerts,
    nc: 3 * numTris,
    arrays: {
      position: new Float32Array(position),
      normal: new Float32Array(normal),
      color: new Uint8Array(color),
      indices: new Uint16Array(indices)
    }
  };
}

// called periodically during download.  Some servers set the file size so 
// progres.lengthComputable is true, which lets us compute the progress
var onProgress = function (progress: ProgressEvent) {
  if (progress.lengthComputable) {
    progressGuage.value = progress.loaded / progress.total * 100;
  }
	console.log("loading: " + progress.loaded + " of " + progress.total +  "...");
}

// of there's an error, this will be called.  We'll log it to the console
var onError = function (error: ErrorEvent) {
	console.log("error! " + error);
}

// HTML dom element callback functions.  Putting them on the window object makes 
// them visible to the DOM elements
window["jsonFileChanged"] = () => {
   // we stored the filename in the select option items value property 
   filename.value = fileSelection.value;
}

window["loadModel"] = () => {
    // reset and show the progress bar
    progressGuage.max = 100;
    progressGuage.value = 0;
    progressGuage.style.visibility = "visible";
    
    // attempt to download the modele
    loader.loadMesh("models/" + filename.value, onLoad, onProgress, onError);
}
 
window["onSubdivide"] = () => {
    console.log("Subdivide called!  You should do the subdivision!");
    var nv = object.nv;
    var nt = object.numTris;
    var nc = object.nc;
    var opposite_table = new Array(object.arrays.indices.length);
    var indices = new Array(object.arrays.indices.length);
    var vertices = new Array(object.vertices.length);
    for(var i = 0; i < object.vertices.length; i++){vertices[i] = object.vertices[i];}
    for (var i = 0; i < indices.length; i++){indices[i] = object.arrays.indices[i];}

    var midPoint = function(i , j){return [((i[0]+j[0])/2), ((i[1]+j[1])/2), ((i[2]+j[2])/2)];} // midpoint formula
    function t_triangle_of_corner (c) {return Math.floor(c/3);} // triangle of corner 
    function n_next_corner (c) {return 3 * t_triangle_of_corner(c) + (c + 1) % 3;} // next corner in the same t(c) 
    function p_prev_corner (c) {return n_next_corner(n_next_corner(c));}  // previous corner in the same t(c) 
    function v_vertex_id (c) {return indices[c];}; //id of the vertex c
    function g_coordinate_vertex (c) {return vertices[v_vertex_id(c)];}; // point of the vertex v(c) of corner c
    function border (c) {return opposite_table[c]==c;}; // if faces a border (has no opposite)
    function o_opposite (c) {return opposite_table[c];}; // opposite (or self)
    function l_left_neighbor (c) {return o_opposite(n_next_corner(c));}; // left neighbor or next if b(n(c))
    function r_right_neighbor (c) {return o_opposite(p_prev_corner(c));}; // right neighbor or next if b(p(c))
    //function s_swing (c) {return n_next_corner(l_left_neighbor(c));}; // swings around v(c) or around a border loop
    function w_index_split(c){ return w_split_new_tris[c]};
    var w_split_new_tris = new Array();
    
    
    // function from slides
    // creates the oppposite table
    var createOtable = function (){
      for (var c = 0; c < nc-1; c++){
        for (var b = c+1; b < nc; b++){
          if(v_vertex_id(n_next_corner(c)) == v_vertex_id(p_prev_corner(b)) && 
             v_vertex_id(p_prev_corner(c)) == v_vertex_id(n_next_corner(b))) {
             opposite_table[c] = b;
             opposite_table[b] = c
          } 
        }
      }
    }
    createOtable();

    // function from slides
    // splits edges in between triangles
    var edge_split = function(){ 
      for (var i = 0; i < nc ; i++){
        if(border(i)){
          vertices[nv] = midPoint(g_coordinate_vertex(n_next_corner(i)),g_coordinate_vertex(p_prev_corner(i)));
          w_split_new_tris[i] = nv++;
        }
        else{
          if (i < o_opposite(i)){
            vertices[nv] = midPoint(g_coordinate_vertex(n_next_corner(i)), g_coordinate_vertex(p_prev_corner(i)));
            w_split_new_tris[o_opposite(i)] = nv;
            w_split_new_tris[i] = nv++;
          }
        }
      }
    }
    edge_split();

    // function from slides
    // creates bulge using midpoint
    var bulge = function(){
      for(var i = 0; i < nc; i++){
        if(i < o_opposite(i) && !border(i)){
          if (!border(p_prev_corner(i)) && !border(n_next_corner(i)) && !border(p_prev_corner(o_opposite(i))) && !border(n_next_corner(o_opposite(i)))){
            var vertex_a_1 = midPoint(g_coordinate_vertex(i), g_coordinate_vertex(o_opposite(i)));
            var vertex_a_2 = midPoint(midPoint(g_coordinate_vertex(l_left_neighbor(i)), g_coordinate_vertex(r_right_neighbor(i))),midPoint(g_coordinate_vertex(l_left_neighbor(o_opposite(i))),g_coordinate_vertex(r_right_neighbor(o_opposite(i)))));
            var vertex_a = vec3.create();
            vertex_a = vec3.subtract(vertex_a, vertex_a_1, vertex_a_2);
            var vertex_a_scaled = vec3.create();
            vec3.scale(vertex_a_scaled, vertex_a, 0.25);
            vec3.add(vertices[w_split_new_tris[i]], vertices[w_split_new_tris[i]], vertex_a_scaled);
          }
        }
      }
    }
    bulge();
    
    // function from slides
    // takes in each triangle and makes it into four triangles
    var tri_split = function(){
        for(var i = 0; i < 3*nt; i=i+3){      
          indices[nt*3+i] = v_vertex_id(i);
          indices[n_next_corner(nt*3+i)] = w_split_new_tris[p_prev_corner(i)];
          indices[p_prev_corner(nt*3+i)] = w_split_new_tris[n_next_corner(i)];
          indices[nt*6+i] = v_vertex_id(n_next_corner(i));
          indices[n_next_corner(nt*6+i)] = w_split_new_tris[i];
          indices[p_prev_corner(nt*6+i)] = w_split_new_tris[p_prev_corner(i)];
          indices[nt*9+i] = v_vertex_id(p_prev_corner(i));
          indices[n_next_corner(nt*9+i)] = w_split_new_tris[n_next_corner(i)];
          indices[p_prev_corner(nt*9+i)] = w_split_new_tris[i];
          indices[i] = w_index_split(i);
          indices[n_next_corner(i)] = w_index_split(n_next_corner(i));
          indices[p_prev_corner(i)] = w_index_split(p_prev_corner(i));
        }
        nt = nt*4;
        nc = nt*3;
    }
    tri_split();

//////////////////////////////////////////////////////////////
    // CODE FROM ONLOAD FUNCTION
    var position = new Array();
    var color = new Array();
    var normal = new Array();

  // position is coordinates of vertices in 1D array
    var populatePosition = function() {
      for(var i = 0; i < nv; i++){
        position.push(vertices[i][0], vertices[i][1], vertices[i][2]);
      }
    }
    populatePosition();

    var populateColor = function() {
      for (var i = 0; i < nv; i++){
        var tempColor = chroma.hsv(rand(360), 0.5, 1);
        color.push(tempColor.rgb()[0], tempColor.rgb()[1], tempColor.rgb()[2], 255);
      }
    }
    populateColor();
    
    // for each triangle i, get the normal by getting the coordinates and doing ab x bc
    // i is triangle number
    var triangleNormal = function(i) {
      var vect_a = vec3.fromValues(position[indices[i]*3], position[indices[i]*3+1], position[indices[i]*3+2]);
      console.dir(vect_a);
      var vect_b = vec3.fromValues(position[indices[i+1]*3], position[indices[i+1]*3+1], position[indices[i+1]*3+2]);
      console.dir(vect_b);
      var vect_c = vec3.fromValues(position[indices[i+2]*3], position[indices[i+2]*3+1], position[indices[i+2]*3+2]);
      console.dir(vect_c);
      
      var vect_ab = vec3.create();
      vec3.subtract(vect_ab, vect_a, vect_b);
      
      var vect_bc = vec3.create();
      vec3.subtract(vect_bc, vect_b, vect_c)
      
      var norm_ab_ac = vec3.create();
      vec3.cross(norm_ab_ac, vect_ab, vect_bc);
      
      return norm_ab_ac;
    }
    
  
    var normal_tri_arr = new Array();
    // for each triangle, get the norm
    var computeTriNormals = function() {
      var count = 0;
      for(var i = 0; i < indices.length; i=i+3){
          normal_tri_arr[count] = triangleNormal(i);
          count++;
      }
    }
    computeTriNormals();

    // function from slides
    // computes vertex normals for each vertex
    var computeVertexNormals = function() {
      for(var i = 0; i < vertices.length; i++){
        normal[i] = vec3.create();
      }  
      
      for(var i = 0; i < normal_tri_arr.length; i++){
        vec3.add(normal[indices[i*3]], normal[indices[i*3]], normal_tri_arr[i]);
        vec3.add(normal[indices[i*3+1]], normal[indices[i*3+1]], normal_tri_arr[i]);
        vec3.add(normal[indices[i*3+2]], normal[indices[i*3+2]], normal_tri_arr[i]);
      }
      
      for(var i = 0; i < normal.length; i++){
        vec3.normalize(normal[i],normal[i]);
      }
      
      var temp = [];
      for(var i = 0; i < normal.length; i++){
        temp.push(normal[i][0],normal[i][1],normal[i][2]);
      }
      normal = [];
      normal = temp;
    }
    computeVertexNormals();
    
  
      // bb1 and bb2 are the corners of the bounding box of the object.  
     var bb1 = object.boundingBox[0];
     var bb2 = object.boundingBox[1];
     
     
     // render
      newObject = {
        boundingBox: [bb1, bb2],
        scaleFactor: 300/vec3.distance(bb1,bb2),  
        center: object.center,
        numElements: indices.length,
        indices: indices,
        vertices: vertices,
        numTris: nt,
        nv: nv,
        nc: nc,
        arrays: {
          position: new Float32Array(position),
          normal: new Float32Array(normal),
          color: new Uint8Array(color),
          indices: new Uint16Array(indices)
      }
  };
} 

////////////////////////////////////////////////////////////////////////////////////////////
// some simple interaction using the mouse.
// we are going to get small motion offsets of the mouse, and use these to rotate the object
//
// our offset() function from assignment 0, to give us a good mouse position in the canvas 
function offset(e: MouseEvent): GLM.IArray {
    e = e || <MouseEvent> window.event;

    var target = <Element> e.target || e.srcElement,
        rect = target.getBoundingClientRect(),
        offsetX = e.clientX - rect.left,
        offsetY = e.clientY - rect.top;

    return vec2.fromValues(offsetX, offsetY);
}

var mouseStart = undefined;  // previous mouse position
var mouseDelta = undefined;  // the amount the mouse has moved
var mouseAngles = vec2.create();  // angle offset corresponding to mouse movement

// start things off with a down press
canvas.onmousedown = (ev: MouseEvent) => {
    mouseStart = offset(ev);        
    mouseDelta = vec2.create();  // initialize to 0,0
    vec2.set(mouseAngles, 0, 0);
}

// stop things with a mouse release
canvas.onmouseup = (ev: MouseEvent) => {
    if (mouseStart != undefined) {
        const clickEnd = offset(ev);
        vec2.sub(mouseDelta, clickEnd, mouseStart);        // delta = end - start
        vec2.scale(mouseAngles, mouseDelta, 10/canvas.height);  

        // now toss the two values since the mouse is up
        mouseDelta = undefined;
        mouseStart = undefined; 
    }
}

// if we're moving and the mouse is down        
canvas.onmousemove = (ev: MouseEvent) => {
    if (mouseStart != undefined) {
      const m = offset(ev);
      vec2.sub(mouseDelta, m, mouseStart);    // delta = mouse - start 
      vec2.copy(mouseStart, m);               // start becomes current position
      vec2.scale(mouseAngles, mouseDelta, 10/canvas.height);

      // console.log("mousemove mouseAngles: " + mouseAngles[0] + ", " + mouseAngles[1]);
      // console.log("mousemove mouseDelta: " + mouseDelta[0] + ", " + mouseDelta[1]);
      // console.log("mousemove mouseStart: " + mouseStart[0] + ", " + mouseStart[1]);
   }
}

// stop things if you move out of the window
canvas.onmouseout = (ev: MouseEvent) => {
    if (mouseStart != undefined) {
      vec2.set(mouseAngles, 0, 0);
      mouseDelta = undefined;
      mouseStart = undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////////////////
// start things off by calling initWebGL
initWebGL();

function initWebGL() {
  // get the rendering context for webGL
  var gl: WebGLRenderingContext = getWebGLContext(canvas);
  if (!gl) {
    return;  // no webgl!  Bye bye
  }

  // turn on backface culling and zbuffering
  gl.enable(gl.CULL_FACE);
  gl.enable(gl.DEPTH_TEST);

  // attempt to download and set up our GLSL shaders.  When they download, processed to the next step
  // of our program, the "main" routing
  loader.loadFiles(['shaders/a3-shader.vert', 'shaders/a3-shader.frag'], function (shaderText) {
    var program = createProgramFromSources(gl, shaderText);
    main(gl, program);
  }, function (url) {
      alert('Shader failed to download "' + url + '"');
  }); 
}

////////////////////////////////////////////////////////////////////////////////////////////
// webGL is set up, and our Shader program has been created.  Finish setting up our webGL application       
function main(gl: WebGLRenderingContext, program: WebGLProgram) {
  
  // use the webgl-utils library to create setters for all the uniforms and attributes in our shaders.
  // It enumerates all of the uniforms and attributes in the program, and creates utility functions to 
  // allow "setUniforms" and "setAttributes" (below) to set the shader variables from a javascript object. 
  // The objects have a key for each uniform or attribute, and a value containing the parameters for the
  // setter function
  var uniformSetters = createUniformSetters(gl, program);
  var attribSetters  = createAttributeSetters(gl, program);

  /// ***************
  /// YOU WILL REMOVE THIS AND REPLACE WITH A MESH YOU LOAD
  var arrays = f3d.createArrays(gl);
  var bb1 = vec3.fromValues(100, 150, 30);
  var bb2 = vec3.fromValues(0, 0, 0);
  object = {
    boundingBox: [bb2,bb1],
    scaleFactor: 300/vec3.distance(bb1,bb2), 
    center: [50, 75, 15],
    numElements: arrays.indices.length,
    arrays: arrays 
  }
  
  var buffers = {
    position: gl.createBuffer(),
    //texcoord: gl.createBuffer(),
    normal: gl.createBuffer(),
    color: gl.createBuffer(),
    indices: gl.createBuffer()
  };
  object.buffers = buffers;
      
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
  gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.STATIC_DRAW);
  //gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
  //gl.bufferData(gl.ARRAY_BUFFER, arrays.texcoord, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
  gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
  gl.bufferData(gl.ARRAY_BUFFER, arrays.color, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.indices, gl.STATIC_DRAW);
  
  var attribs = {
    a_position: { buffer: buffers.position, numComponents: 3, },
    a_normal:   { buffer: buffers.normal,   numComponents: 3, },
    //a_texcoord: { buffer: buffers.texcoord, numComponents: 2, },
    a_color:    { buffer: buffers.color,    numComponents: 4, type: gl.UNSIGNED_BYTE, normalize: true  }
  };

  /// you will need to set up your arrays and then create your buffers
  /// ********************
  
  
  function degToRad(d) {
    return d * Math.PI / 180;
  }

  var cameraAngleRadians = degToRad(0);
  var fieldOfViewRadians = degToRad(60);
  var cameraHeight = 50;

  var uniformsThatAreTheSameForAllObjects = {
    u_lightWorldPos:         [50, 30, -100],
    u_viewInverse:           mat4.create(),
    u_lightColor:            [1, 1, 1, 1],
    u_ambient:               [0.1, 0.1, 0.1, 0.1]
  };

  var uniformsThatAreComputedForEachObject = {
    u_worldViewProjection:   mat4.create(),
    u_world:                 mat4.create(),
    u_worldInverseTranspose: mat4.create(),
  };

  // var textures = [
  //   textureUtils.makeStripeTexture(gl, { color1: "#FFF", color2: "#CCC", }),
  //   textureUtils.makeCheckerTexture(gl, { color1: "#FFF", color2: "#CCC", }),
  //   textureUtils.makeCircleTexture(gl, { color1: "#FFF", color2: "#CCC", }),
  // ];

  var baseColor = rand(240);
  var objectState = { 
      materialUniforms: {
        u_colorMult:             chroma.hsv(rand(baseColor, baseColor + 120), 0.5, 1).gl(),
        //u_diffuse:               textures[randInt(textures.length)],
        u_specular:              [1, 1, 1, 1],
        u_shininess:             450,
        u_specularFactor:        0.75,
      }
  };

  // some variables we'll reuse below
  var projectionMatrix = mat4.create();
  var viewMatrix = mat4.create();
  var rotationMatrix = mat4.create();
  var matrix = mat4.create();  // a scratch matrix
  var invMatrix = mat4.create();
  var axisVector = vec3.create();
  
  requestAnimationFrame(drawScene);

  // Draw the scene.
  function drawScene(time: number) {
    time *= 0.001; 

    // reset the object if a new one has been loaded
    if (newObject) {
      object = newObject;
      newObject = undefined;
      
      arrays = object.arrays;
      buffers = {
        position: gl.createBuffer(),
        //texcoord: gl.createBuffer(),
        normal: gl.createBuffer(),
        color: gl.createBuffer(),
        indices: gl.createBuffer()
      };
      object.buffers = buffers;
      
      // For each of the new buffers, load the array data into it. 
      // first, bindBuffer sets it as the "current Buffer" and then "bufferData"
      // loads the data into it.  Each array (vertex, color, normal, texture coordinates)
      // has the same number of entries, and is used together by the shaders when it's
      // index is referenced by the index array for the triangle list
      
      // vertex positions
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
      gl.bufferData(gl.ARRAY_BUFFER, arrays.position, gl.STATIC_DRAW);

      // texture coordinates
      //gl.bindBuffer(gl.ARRAY_BUFFER, buffers.texcoord);
      //gl.bufferData(gl.ARRAY_BUFFER, arrays.texcoord, gl.STATIC_DRAW);

      // vertex normals
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.normal);
      gl.bufferData(gl.ARRAY_BUFFER, arrays.normal, gl.STATIC_DRAW);

      // vertex colors
      gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
      gl.bufferData(gl.ARRAY_BUFFER, arrays.color, gl.STATIC_DRAW);

      // triangle indices.  
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, arrays.indices, gl.STATIC_DRAW);

      // the attribute data to be used by the "setAttributes" utility function
      attribs = {
        a_position: { buffer: buffers.position, numComponents: 3, },
        a_normal:   { buffer: buffers.normal,   numComponents: 3, },
        //a_texcoord: { buffer: buffers.texcoord, numComponents: 2, },
        a_color:    { buffer: buffers.color,    numComponents: 4, type: gl.UNSIGNED_BYTE, normalize: true  }
      }; 
      
      // reset the rotation matrix
      rotationMatrix = mat4.identity(rotationMatrix);     
    }    
   
    // measure time taken for the little stats meter
    stats.begin();

    // if the window changed size, reset the WebGL canvas size to match.  The displayed size of the canvas
    // (determined by window size, layout, and your CSS) is separate from the size of the WebGL render buffers, 
    // which you can control by setting canvas.width and canvas.height
    resizeCanvasToDisplaySize(canvas);

    // Set the viewport to match the canvas
    gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Clear the canvas AND the depth buffer.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Compute the projection matrix
    var aspect = canvas.clientWidth / canvas.clientHeight;
    mat4.perspective(projectionMatrix,fieldOfViewRadians, aspect, 1, 2000);

    // Compute the camera's matrix using look at.
    var cameraPosition = [0, 0, -200];
    var target = [0, 0, 0];
    var up = [0, 1, 0];
    var cameraMatrix = mat4.lookAt(uniformsThatAreTheSameForAllObjects.u_viewInverse, cameraPosition, target, up);

    // Make a view matrix from the camera matrix.
    mat4.invert(viewMatrix, cameraMatrix);
    
    // tell WebGL to use our shader program.  probably don't need to do this each time, since we aren't
    // changing it, but it doesn't hurt in this simple example.
    gl.useProgram(program);
    
    // Setup all the needed attributes.   This utility function does the following for each attribute, 
    // where "index" is the index of the shader attribute found by "createAttributeSetters" above, and
    // "b" is the value of the entry in the "attribs" array cooresponding to the shader attribute name:
    //   gl.bindBuffer(gl.ARRAY_BUFFER, b.buffer);
    //   gl.enableVertexAttribArray(index);
    //   gl.vertexAttribPointer(
    //     index, b.numComponents || b.size, b.type || gl.FLOAT, b.normalize || false, b.stride || 0, b.offset || 0);    
    setAttributes(attribSetters, attribs);

    // Bind the indices for use in the index-based drawElements below
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Set the uniforms that are the same for all objects.  Unlike the attributes, each uniform setter
    // is different, depending on the type of the uniform variable.  Look in webgl-util.js for the
    // implementation of  setUniforms to see the details for specific types       
    setUniforms(uniformSetters, uniformsThatAreTheSameForAllObjects);
   
    ///////////////////////////////////////////////////////
    // Compute the view matrix and corresponding other matrices for rendering.
    
    // first make a copy of our rotationMatrix
    mat4.copy(matrix, rotationMatrix);
    
    // adjust the rotation based on mouse activity.  mouseAngles is set if user is dragging 
    if (mouseAngles[0] !== 0 || mouseAngles[1] !== 0) {
      // need an inverse world transform so we can find out what the world X axis for our first rotation is
      mat4.invert(invMatrix, matrix);
      // get the world X axis
      var xAxis = vec3.transformMat4(axisVector, vec3.fromValues(1,0,0), invMatrix);

      // rotate about the world X axis (the X parallel to the screen!)
      mat4.rotate(matrix, matrix, -mouseAngles[1], xAxis);
      
      // now get the inverse world transform so we can find the world Y axis
      mat4.invert(invMatrix, matrix);
      // get the world Y axis
      var yAxis = vec3.transformMat4(axisVector, vec3.fromValues(0,1,0), invMatrix);

      // rotate about teh world Y axis
      mat4.rotate(matrix, matrix, mouseAngles[0], yAxis);
  
      // save the resulting matrix back to the cumulative rotation matrix 
      mat4.copy(rotationMatrix, matrix);
      vec2.set(mouseAngles, 0, 0);        
    }   

    // add a translate and scale to the object World xform, so we have:  R * T * S
    mat4.translate(matrix, rotationMatrix, [-object.center[0]*object.scaleFactor, -object.center[1]*object.scaleFactor, 
                                            -object.center[2]*object.scaleFactor]);
    mat4.scale(matrix, matrix, [object.scaleFactor, object.scaleFactor, object.scaleFactor]);
    mat4.copy(uniformsThatAreComputedForEachObject.u_world, matrix);
    
    // get proj * view * world
    mat4.multiply(matrix, viewMatrix, uniformsThatAreComputedForEachObject.u_world);
    mat4.multiply(uniformsThatAreComputedForEachObject.u_worldViewProjection, projectionMatrix, matrix);

    // get worldInvTranspose.  For an explaination of why we need this, for fixing the normals, see
    // http://www.unknownroad.com/rtfm/graphics/rt_normals.html
    mat4.transpose(uniformsThatAreComputedForEachObject.u_worldInverseTranspose, 
                   mat4.invert(matrix, uniformsThatAreComputedForEachObject.u_world));

    // Set the uniforms we just computed
    setUniforms(uniformSetters, uniformsThatAreComputedForEachObject);

    // Set the uniforms that are specific to the this object.
    setUniforms(uniformSetters, objectState.materialUniforms);

    // Draw the geometry.   Everything is keyed to the ""
    gl.drawElements(gl.TRIANGLES, object.numElements, gl.UNSIGNED_SHORT, 0);

    // stats meter
    stats.end();

    requestAnimationFrame(drawScene);
  }
}

