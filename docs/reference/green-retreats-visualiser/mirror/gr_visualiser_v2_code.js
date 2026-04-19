'use strict';
window.parent.document.querySelector('.left_panel').style.display = 'none';
window.parent.document.querySelector('.summary-wrapper').style.display = 'none';

window.addEventListener('load', function () {

  var CONTAINER_ID = 'v3d-container';

  var preloader = new v3d.SimplePreloader({ container: CONTAINER_ID });
  preloader.onUpdate = (percent) => {
    try {
      window.document.getElementsByClassName('v3d-simple-preloader-bar')[0].style.width = percent + '%';
      window.document.getElementsByClassName('v3d-simple-preloader-bar')[0].innerHTML = '<p>' + parseInt(percent) + '%</p>';
    } catch(e) {

    }
  }
  
  var app = new v3d.App(CONTAINER_ID, null,
    preloader);

  var url = './gr_visualiser_v2_code.gltf.xz';

  var _pGlob = {};

  _pGlob.objCache = {};
  _pGlob.fadeAnnotations = true;
  _pGlob.objClickCallbacks = [];
  _pGlob.pickedObject = '';
  _pGlob.objHoverCallbacks = [];
  _pGlob.hoveredObject = '';
  _pGlob.objMovementInfos = {};
  _pGlob.objDragOverCallbacks = [];
  _pGlob.objDragOverInfoByBlock = {};
  _pGlob.dragMoveOrigins = {};
  _pGlob.dragScaleOrigins = {};
  _pGlob.mediaElements = {};
  _pGlob.loadedFiles = {};
  _pGlob.loadedFile = '';
  _pGlob.animMixerCallbacks = [];
  _pGlob.arHitPoint = new v3d.Vector3(0, 0, 0);
  _pGlob.states = [];
  _pGlob.percentage = 0;
  _pGlob.animateParamUpdate = null;
  _pGlob.openedFile = '';
  _pGlob.xrSessionAcquired = false;
  _pGlob.xrSessionCallbacks = [];
  _pGlob.screenCoords = new v3d.Vector2();
  _pGlob.gamepadIndex = 0;

  _pGlob.AXIS_X = new v3d.Vector3(1, 0, 0);
  _pGlob.AXIS_Y = new v3d.Vector3(0, 1, 0);
  _pGlob.AXIS_Z = new v3d.Vector3(0, 0, 1);
  _pGlob.MIN_DRAG_SCALE = 10e-4;
  _pGlob.SET_OBJ_ROT_EPS = 1e-8;

  _pGlob.vec2Tmp = new v3d.Vector2();
  _pGlob.vec2Tmp2 = new v3d.Vector2();
  _pGlob.vec3Tmp = new v3d.Vector3();
  _pGlob.vec3Tmp2 = new v3d.Vector3();
  _pGlob.vec3Tmp3 = new v3d.Vector3();
  _pGlob.vec3Tmp4 = new v3d.Vector3();
  _pGlob.eulerTmp = new v3d.Euler();
  _pGlob.eulerTmp2 = new v3d.Euler();
  _pGlob.quatTmp = new v3d.Quaternion();
  _pGlob.quatTmp2 = new v3d.Quaternion();
  _pGlob.mat4Tmp = new v3d.Matrix4();
  _pGlob.planeTmp = new v3d.Plane();
  _pGlob.raycasterTmp = new v3d.Raycaster();
  _pGlob.intervals = {};

  var _pPhysics = {};

  _pPhysics.tickCallbacks = [];
  _pPhysics.syncList = [];

  // internal info
  _pPhysics.collisionData = [];

  // goes to collision callback
  _pPhysics.collisionInfo = {
      objectA: '',
      objectB: '',
      distance: 0,
      positionOnA: [0, 0, 0],
      positionOnB: [0, 0, 0],
      normalOnB: [0, 0, 0]
  };

  var PL = v3d.PL = v3d.PL || {};

  // a more readable alias for PL (stands for "Puzzle Logic")
  v3d.puzzles = PL;

  PL.procedures = PL.procedures || {};
  
  var id, AR_available;
  
  app.loadScene(url, function () {
    app.enableControls();
    app.run();
    // app.showFPS();
    v3d.Cache.enabled = true;

    let visualiser = new Visualiser();
  });

  class Visualiser {
    constructor(loadBuildingData) {
      this.frontWallMeshes = [];
      this.frontWallCapMeshes = [];
      this.frontWallMelamineMeshes = [];
      this.frontWallMelamineCapMeshes = [];
      this.frontWallSkirting = [];
      this.frontWallDoorCap = [];
      this.backWallMeshes = [];
      this.backWallMelamineMeshes = [];
      this.backWallSkirting = [];
      this.leftWallMeshes = [];
      this.leftWallMelamineMeshes = [];
      this.leftWallSkirting = [];
      this.rightWallMeshes = [];
      this.rightWallMelamineMeshes = [];
      this.rightWallSkirting = [];
      this.gutterMeshes = [];
      this.deckMeshes = [];
      this.floorMeshes = [];
      this.currentRoofMeshes = [];
      this.melamineCeilings = [];
      this.currentGutterMeshes = [];
      this.currentDeckMeshes = [];
      
      this.gutterMesh;
      this.deckMesh;
      this.roofMesh;
      this.roofMeshAlt;
      this.buildingTypes = ['INSP', 'EXPR', 'EDGE', 'PINN', 'TGO1', 'TGO2', 'TGO3', 'TGO4'];
      this.claddingTypes = ['Cedar', 'Redwood', 'Honey', 'Composite', 'Redwood_Slatted', 'Honey_Slatted', 'Composite_Cedar', 'Composite_Oak', 'Composite_Grey'];
      this.doorTypes;
      this.roofMeshBuildingTypes = [];
      this.floorMeshDepths = [];
      this.currentDeck;
      this.currentDeckCladding = 'Redwood';
      this.currentBuilding = 'INSP';
      this.currentFloor = 'Grey';
      this.currentInterior = 'Melamine';
      this.doorWidths;
      this.tgoLeftWallCap;
      this.tgoLeftWallCap2;
      this.cornerPost;
      this.cornerPost2;
      this.backWallEndPanel;
      this.buildingWidth;
      this.currentGutterRange;
      this.rightWallDepthMesh;
      this.currentDoor;
      this.doorPosition = 0;
      this.buildingDepth;
      this.currentCladding = 'Redwood';
      this.currentFascia = 'Natural';
      this.currentRoofMesh;
      this.doorWidth;
      this.tgoFullHeightWindow = 0;
      this.tgoScreen;
      this.window;
      this.buildingRange = 'GR';
      this.garden;
      this.buildingURL;
      this.priceData;
      this.blackHood = false;
      this.bloomThreshold = 0.097;
      this.bloomStrength = 0.05;
      this.bloomRadius = 0;

      this.price = 0;
      this.loadBuildingData = loadBuildingData;
      this.debugMode = false;
      
      this.Init();
    }

    Init() {
      app.renderer.setPixelRatio(window.devicePixelRatio);
      app.postprocessing = false;
      if (app.postprocessing) {
        app.postprocessing.composer.setPixelRatio(1);
      }
      app.onResize();

      // Fix for Mac and iOS Safari to stop meshes behind the shadowmatte becoming transparent
      app.scene.traverse(function(obj) {
        if (obj.material && obj.material.isMeshNodeMaterial &&
          obj.material.hasNode('SHADOW_MATTE_AR'))
          obj.renderOrder = 1000;
      });

      this.ChangeBloom();

      this.buildingWidth = 10;
      this.buildingDepth = 6;

      this.random = false;

      this.arIndicatorRotation;

      this.InitDoorTypes();
      this.AttachEvents();
      
      this.GenerateBuilding();

      let queryString = window.parent.parent.location.search;
      if (queryString) {
        let urlParams = new URLSearchParams(queryString);
        if (urlParams.get('r')) {
          this.LoadBuildingFromParams(urlParams);
        }
      }

      if (window.parent.parent.location.search.includes('random')) {
        this.random = true;

        setInterval(() => {
          this.RandomBuilding();
        }, 500);
      }

      this.GetPricingData();
      
      let currentURL = window.parent.parent.location.pathname;
      if (this.debugMode) {
        console.log(currentURL);
      }
      for (let building of this.buildingTypes) {
        let buildingName;
        if (currentURL.includes('inspiration')) {
          buildingName = 'INSP';
        } else if (currentURL.includes('expression')) {
          buildingName = 'EXPR';
        } else if (currentURL.includes('edge')) {
          buildingName = 'EDGE';
        } else if (currentURL.includes('pinnacle')) {
          buildingName = 'PINN';
        } else if (currentURL.includes('tgo1')) {
          buildingName = 'TGO1';
        } else if (currentURL.includes('tgo2')) {
          buildingName = 'TGO2';
        } else if (currentURL.includes('tgo3')) {
          buildingName = 'TGO3';
        } else if (currentURL.includes('tgo4')) {
          buildingName = 'TGO4';
        } else if (currentURL.includes('g1')) {
          buildingName = 'TGO1';
        } else if (currentURL.includes('g2')) {
          buildingName = 'TGO2';
        } else if (currentURL.includes('g3')) {
          buildingName = 'TGO3';
        } else if (currentURL.includes('g4')) {
          buildingName = 'PINN';
        } else if (currentURL.includes('g5')) {
          buildingName = 'TGO4';
        }
        
        if (buildingName == building) {
          this.ChangeCurrentBuilding(building);
        }
      }
      
      if (this.debugMode) {
        console.log(window.parent.document.querySelector('#bottom_panel'));
      }
      window.parent.document.querySelector('#bottom_panel').style.display = 'block';
      window.parent.document.getElementsByClassName('button-bar')[0].style.display = 'flex';
      window.parent.document.getElementById('cladding_cedarprm').style.display = 'none';

      this.UpdateMaterials();
      this.UpdateBuilding();

      this.EmailBuilding();

      window.parent.document.querySelectorAll('.left_panel').forEach((el) => el.style.display = 'block');
      window.parent.document.querySelectorAll('.summary-wrapper').forEach((el) => el.style.display = 'block');
    }

    ChangeBloom() {
      app.enablePostprocessing([{
        type: 'bloom',
        threshold: this.bloomThreshold,
        strength: this.bloomStrength,
        radius: this.bloomRadius
      }]);
    }

    GetPricingData() {
      this.priceData = window.priceData;
      if (this.debugMode) {
        console.log(this.priceData);
      }
    }

    LoadBuilding(id) {
      let json;
      if (id) {
        json = JSON.parse(localStorage.getItem('buildings'))[id];
      } else if (this.loadBuildingData) {
        json = JSON.parse(this.loadBuildingData);
      }

      if (!json) {
        console.error('Could not load building data!');

        return;
      }
      
      this.currentBuilding = json.buildingType;
      this.currentCladding = json.cladding;
      this.buildingWidth = json.width;
      this.buildingDepth = json.depth;
      this.currentDoor = json.door;
      this.doorWidth = json.doorWidth;
      this.doorPosition = json.doorPosition;
      this.tgoFullHeightWindow = json.tgoFullHeightWindow;
      this.buildingRange = json.buildingRange;

      this.UpdateMaterials();
      this.UpdateBuilding();
    }

    LoadBuildingFromParams(params) {
      this.buildingRange = params.get('r').toLowerCase();
      let building = parseInt(params.get('b'));

      if (this.buildingRange == 'g') {
        switch (building) {
          case 1:
            this.currentBuilding = 'TGO1';
            break;
          case 2:
            this.currentBuilding = 'TGO2';
            break; 
          case 3:
            this.currentBuilding = 'TGO3';
            break;
          case 4:
            this.currentBuilding = 'PINN';
            break;
          case 5:
            this.currentBuilding = 'TGO4';
            break;
        }
      } else {
        this.currentBuilding = building;
      }
      
      let width = parseInt(params.get('wi'));
      this.buildingWidth = width;
      this.buildingDepth = parseInt(params.get('d'));
      this.currentCladding = params.get('c');
      this.currentDeckCladding = params.get('dc');
      this.currentFascia = params.get('f');

      let doorType = params.get('do');
      for (let i = 0; i < this.doorTypes.length; i++) {
        if (doorType == this.doorTypes[i].name) {
          this.currentDoor = this.doorTypes[i];
        }
      }

      if (this.buildingWidth === 4) {
        this.currentDoor = this.doorTypes[10];
        this.doorWidth = this.doorWidths[10];
      } else {
        this.doorWidth = parseInt(params.get('dw'));
      }
      
      this.doorPosition = parseInt(params.get('dp'));
      this.currentFloor = params.get('flr');
      this.currentInterior = params.get('i');
      this.tgoFullHeightWindow = parseInt(params.get('fhw'));
      this.price = params.get('p');
      
      if (params.get('bhd') == 'true') {
        this.blackHood = true;
      } else {
        this.blackHood = false;
      }

      let width_slider = window.parent.document.getElementById('width_slider');
      width_slider.value = this.buildingWidth;

      let depth_slider = window.parent.document.getElementById('depth_slider');
      depth_slider.value = this.buildingDepth;

      if (this.debugMode) {
        console.log(`Loading building:
                    Range: ${this.buildingRange}
                    Building: ${this.currentBuilding}
                    Width: ${this.buildingWidth}
                    Depth: ${this.buildingDepth}
                    Cladding: ${this.currentCladding}
                    Deck Cladding: ${this.currentDeckCladding}
                    Fascia: ${this.currentFascia}
                    Door: ${this.currentDoor.name}
                    Door Width: ${this.doorWidth}
                    Door Position: ${this.doorPosition}
                    Floor: ${this.currentFloor}
                    Finish: ${this.currentInterior}
                    TGO Window: ${this.tgoFullHeightWindow}
                    Price: ${this.price}
                    `);
      }

      this.UpdateBuildingSpecificDefaults();
      
      this.UpdateMaterials();
      this.UpdateBuilding();
    }
  
    AttachEvents() {
      // let ARButton = window.parent.document.getElementById('ar-mode');
      // if (this.FeatureAvailable('ANDROID')) { 
      //   ARButton.style.display = 'block';
      //   console.log(ARButton);

      //   ARButton.addEventListener('click', (e) => {
      //     this.EnterAR();
      //   });
      // }

      let usdzARButton = window.parent.document.getElementById('ar-mode-usdz');
      let arPopup = window.parent.parent.document.getElementById('ios-ar-popup-container');
      if (this.FeatureAvailable('IOS') && window.navigator.userAgent.indexOf('CriOS') === -1) {
        usdzARButton.style.display = 'block';
        
        usdzARButton.addEventListener('click', async (e) => {
          arPopup.style.display = 'flex';

          // console.log(this.GetObject('SM_Deck_1a_Left1').scale);
          // this.GetObject('SM_Deck_1a_Left1').scale.x = 0.01;
          // this.GetObject('SM_Deck_1a_Left1').scale.y = 0.01;
          // this.GetObject('SM_Deck_1a_Left1').scale.z = 0.01;
          // console.log(this.GetObject('SM_Deck_1a_Left1').scale);

          // this.GetObject('SM_Deck_1a_Left1').position.x = 0;
          // this.GetObject('SM_Deck_1a_Left1').position.y = -1000;
          // this.GetObject('SM_Deck_1a_Left1').position.z = -5;
          // this.HideAllObjects();
          // this.ShowObject(this.GetObject('Dome_Lythwood_Field'));
          // this.GetObject('Dome_Lythwood_Field').scale.x = 0.01;
          // this.GetObject('Dome_Lythwood_Field').scale.y = 0.01;
          // this.GetObject('Dome_Lythwood_Field').scale.z = 0.01;

          // this.GetObject('Dome_Lythwood_Field').position.x = 0;
          // this.GetObject('Dome_Lythwood_Field').position.y = 0;
          // this.GetObject('Dome_Lythwood_Field').position.z = 0;
          window.parent.parent.document.getElementById('usdz-link-ios').href = await this.EnterARModeUSDZ('Scene');
          // var imageUrl = 'https://' + window.parent.parent.location.hostname + '/visualiser-ar-ios/ar-image.png';
          // window.parent.parent.document.getElementById('usdz-link-ios').innerHTML = `<img src="${imageUrl}">`;

          window.parent.parent.document.getElementById('usdz-link-ios').addEventListener('click', (e) => {
            this.SaveState(['Camera', 'SM_Deck_1a_Left1', 'indicator_group', 'bgSphere', 'Dome_Lythwood_Field'], '');
            
            this.HideObject(this.GetObject('bgSphere'));
            this.HideObject(this.GetObject('Dome_Lythwood_Field'));
            this.HideObject(this.GetObject('Shadowmatte'));
          });
        });
      }

      var self = this;
      this.RegisterOnClick('indicator_invis_plane', false, false, [0,1,2], function() {
        self.ShowObject(self.GetObject('SM_Deck_1a_Left1'));

        self.GetObject('SM_Deck_1a_Left1').position.x = self.ARHitPoint('x');
        self.GetObject('SM_Deck_1a_Left1').position.y = self.ARHitPoint('y');
        self.GetObject('SM_Deck_1a_Left1').position.z = self.ARHitPoint('z');

        self.GetObjTransform('SM_Deck_1a_Left1').rotation = self.GetObjTransform('indicator_group').rotation;
      }, function() {});
      
      let widthArrowDecrease = window.parent.document.querySelectorAll('.widthblock-mobile .arrow-width-left')[0];
      let widthArrowIncrease = window.parent.document.querySelectorAll('.widthblock-mobile .arrow-width-right')[0];
      
      let visualiserLinks = window.parent.parent.document.getElementsByClassName('visualiser-link');
      for (let link of visualiserLinks) {
        link.addEventListener('click', (e) => {
          let data = {
            // buildingType: e.currentTarget.getAttribute('data-building'),
            width: e.currentTarget.getAttribute('data-width'),
            depth: e.currentTarget.getAttribute('data-depth')
          }

          this.buildingWidth = data.width;
          this.buildingDepth = data.depth;
          this.UpdateBuilding();
          // this.ChangeCurrentBuilding(data.buildingType);
        });
      }
      
      widthArrowDecrease.addEventListener('click', (e) => {
        if (this.buildingWidth > 4 && (this.doorPosition + this.doorWidth) < this.buildingWidth - 1) {
          this.buildingWidth--;

          this.UpdateBuilding();
        }
      });

      widthArrowIncrease.addEventListener('click', (e) => {
        if (this.buildingWidth < 20) {
          this.buildingWidth++;

          this.UpdateBuilding();
        }
      });

      let depthArrowDecrease = window.parent.document.querySelectorAll('.depthblock-mobile .arrow-width-left')[0];
      let depthArrowIncrease = window.parent.document.querySelectorAll('.depthblock-mobile .arrow-width-right')[0];
      depthArrowDecrease.addEventListener('click', (e) => {
        if (this.buildingDepth > 5) {
          this.buildingDepth--;

          this.UpdateBuilding();
        }
      });

      depthArrowIncrease.addEventListener('click', (e) => {
        if (e.currentTarget.style.opacity < 1) {
          return;
        }
        
        if (this.buildingDepth < 10) {
          this.buildingDepth++;

          this.UpdateBuilding();
        }
      });

      let widthSlider = window.parent.document.getElementById('width_slider');
      let depthSlider = window.parent.document.getElementById('depth_slider');
      widthSlider.addEventListener('input', (e) => {
        if (this.doorWidth < e.target.value) {
          this.buildingWidth = parseInt(e.target.value);
        }

        this.UpdateBuilding();
      });
  
      depthSlider.addEventListener('input', (e) => {
        this.buildingDepth = parseInt(e.target.value);
        
        this.UpdateBuilding();
      });

      // Door
      let doorArrowDecrease = window.parent.document.querySelectorAll('.doorblock .arrow-width-left')[0];
      let doorArrowDecreaseMobile = window.parent.document.querySelectorAll('.doorblock-mobile .arrow-width-left')[0];
      let doorArrowIncrease = window.parent.document.querySelectorAll('.doorblock .arrow-width-right')[0];
      let doorArrowIncreaseMobile = window.parent.document.querySelectorAll('.doorblock-mobile .arrow-width-right')[0];
      doorArrowDecrease.addEventListener('click', (e) => {
        this.doorPosition--;

        this.UpdateBuilding();
      });
      doorArrowDecreaseMobile.addEventListener('click', (e) => {
        this.doorPosition--;

        this.UpdateBuilding();
      });

      doorArrowIncrease.addEventListener('click', (e) => {
        this.doorPosition++;

        this.UpdateBuilding();
      });
      doorArrowIncreaseMobile.addEventListener('click', (e) => {
        this.doorPosition++;

        this.UpdateBuilding();
      });

      // Building type
      // window.parent.document.getElementById('model_expression').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_natural'), true);
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.ChangeCurrentBuilding('EXPR');
      // });

      // window.parent.document.getElementById('model_inspiration').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_natural'), true);
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.ChangeCurrentBuilding('INSP');
      // });

      // window.parent.document.getElementById('model_edge').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_black'), true);
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.ChangeCurrentBuilding('EDGE');
      // });

      window.parent.document.getElementById('model_pinnacle').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_natural'), true);
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.ChangeCurrentBuilding('PINN');
      });

      window.parent.document.getElementById('model_tgo1').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_grey'), true);

        this.ChangeCurrentBuilding('TGO1');
      });

      window.parent.document.getElementById('model_tgo2').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_grey'), true);
        this.ChangeCurrentBuilding('TGO2');
      });

      window.parent.document.getElementById('model_tgo3').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_grey'), true);
        this.ChangeCurrentBuilding('TGO3');
      });

      window.parent.document.getElementById('model_tgo4').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_grey'), true);
        this.ChangeCurrentBuilding('TGO4');
      });

      // Cladding
      window.parent.document.getElementById('cladding_redwood').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentCladding = 'Redwood';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('cladding_honey').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentCladding = 'Honey';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('cladding_cedarstd').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentCladding = 'Cedar';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('cladding_cedarprm').addEventListener('click', (e) => {
        // this.UpdateActiveMenuItem(e.currentTarget, true);
        // this.currentCladding = 'Cedar_Premium';
        
        // this.UpdateMaterials();
        // this.UpdateBuilding();
      });

      // Composite cedar not yet available
      window.parent.document.getElementById('cladding_compcedar').style.display = 'none';
      // window.parent.document.getElementById('cladding_compcedar').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.currentCladding = 'Composite_Cedar';
      //   this.currentFascia = 'Black';
        
      //   this.UpdateMaterials();
      //   this.UpdateBuilding();
      // });

      window.parent.document.getElementById('cladding_compoak').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentCladding = 'Composite_Oak';
        this.currentFascia = 'Black';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // window.parent.document.getElementById('cladding_compgrey').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.currentCladding = 'Composite_Grey';
      //   this.currentFascia = 'Black';
        
      //   this.UpdateMaterials();
      //   this.UpdateBuilding();
      // });

      // window.parent.document.getElementById('cladding_redwoodslatted').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.currentCladding = 'Redwood_Slatted';
        
      //   this.UpdateMaterials();
      //   this.UpdateBuilding();
      // });

      // window.parent.document.getElementById('cladding_honeyslatted').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.currentCladding = 'Honey_Slatted';
        
      //   this.UpdateMaterials();
      //   this.UpdateBuilding();
      // });

      // window.parent.document.getElementById('cladding_cedarslatted').addEventListener('click', (e) => {
      //   this.UpdateActiveMenuItem(e.currentTarget, true);
      //   this.currentCladding = 'Cedar_Slatted';
        
      //   this.UpdateMaterials();
      //   this.UpdateBuilding();
      // });

      window.parent.document.getElementById('cladding_black').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentCladding = 'Composite';
        if (this.currentFascia == 'Natural')
        {
          this.currentFascia = 'Black';
        }
        this.blackHood = true;
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // Deck
      window.parent.document.getElementById('deck_redwood').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentDeckCladding = 'Redwood';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('deck_honey').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentDeckCladding = 'Honey';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('deck_cedar').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentDeckCladding = 'Cedar';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('deck_black').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentDeckCladding = 'Black';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('deck_grey').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentDeckCladding = 'Grey';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // Doors
      window.parent.document.getElementById('door_bifold28').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[0];
        this.doorWidth = this.doorWidths[0];
        
        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_bifold38').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[1];
        this.doorWidth = this.doorWidths[1];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_french15').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[10];
        this.doorWidth = this.doorWidths[10];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_french23').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[2];
        this.doorWidth = this.doorWidths[2];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_french28').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[3];
        this.doorWidth = this.doorWidths[3];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_french38').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[4];
        this.doorWidth = this.doorWidths[4];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_slidefold28').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[5];
        this.doorWidth = this.doorWidths[5];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_slidefold38').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[6];
        this.doorWidth = this.doorWidths[6];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_sliding23').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[7];
        this.doorWidth = this.doorWidths[7];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_sliding28').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[8];
        this.doorWidth = this.doorWidths[8];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('door_sliding38').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget, true);
        this.currentDoor = this.doorTypes[9];
        this.doorWidth = this.doorWidths[9];

        if (this.doorWidth > this.buildingWidth - 1) {
          this.buildingWidth = this.doorWidth + 1;
        }
        
        this.UpdateBuilding();
      });

      // Fascia
      window.parent.document.getElementById('fascia_natural').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFascia = 'Natural';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });
      
      window.parent.document.getElementById('fascia_graphite').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFascia = 'Graphite';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('fascia_black').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFascia = 'Black';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('hood_natural').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.blackHood = false;

        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('hood_black').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.blackHood = true;

        if (this.currentBuilding == 'EDGE') {
          this.currentDeckCladding = 'Black';
        }

        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // Floor
      window.parent.document.getElementById('floor_white').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFloor = 'White';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('floor_grey').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFloor = 'Grey';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('floor_oak').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentFloor = 'Oak';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // Interior
      window.parent.document.getElementById('wall_melamine').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentInterior = 'Melamine';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });
      
      window.parent.document.getElementById('wall_plastered').addEventListener('click', (e) => {
        this.UpdateActiveMenuItem(e.currentTarget);
        this.currentInterior = 'Plaster';
        
        this.UpdateMaterials();
        this.UpdateBuilding();
      });

      // Garden
      window.parent.document.getElementById('garden_on').addEventListener('click', (e) => {
        window.parent.document.getElementById('garden_on').style.display = 'none';
        window.parent.document.getElementById('garden_off').style.display = 'block';
        
        this.ToggleGarden(true);
      });

      window.parent.document.getElementById('garden_off').addEventListener('click', (e) => {
        window.parent.document.getElementById('garden_on').style.display = 'block';
        window.parent.document.getElementById('garden_off').style.display = 'none';

        this.ToggleGarden(false);
        this.ResetCamera();
      });

      // Window
      window.parent.document.getElementById('fhwindow_none').addEventListener('click', (e) => {
        window.parent.document.getElementById('fhwindow_none').classList.add('window-active');

        window.parent.document.getElementById('fhwindow_05').classList.remove('window-active');
        window.parent.document.getElementById('fhwindow_1').classList.remove('window-active');

        this.tgoFullHeightWindow = 0;

        this.UpdateBuilding();
      });

      window.parent.document.getElementById('fhwindow_05').addEventListener('click', (e) => {
        window.parent.document.getElementById('fhwindow_05').classList.add('window-active');

        window.parent.document.getElementById('fhwindow_none').classList.remove('window-active');
        window.parent.document.getElementById('fhwindow_1').classList.remove('window-active');
        
        this.tgoFullHeightWindow = 1;

        this.UpdateBuilding();
      });

      window.parent.document.getElementById('fhwindow_1').addEventListener('click', (e) => {
        window.parent.document.getElementById('fhwindow_1').classList.add('window-active');

        window.parent.document.getElementById('fhwindow_none').classList.remove('window-active');
        window.parent.document.getElementById('fhwindow_05').classList.remove('window-active');
        
        this.tgoFullHeightWindow = 2;

        this.UpdateBuilding();
      });

      // Side screen
      window.parent.document.getElementById('sidescreen_on').addEventListener('click', (e) => {
        this.tgoScreen = false;

        this.UpdateBuilding();
      });

      window.parent.document.getElementById('sidescreen_off').addEventListener('click', (e) => {
        this.tgoScreen = true;
        
        this.UpdateBuilding();
      });

      window.parent.document.getElementById('reset_camera').addEventListener('click', (e) => {
        this.ResetCamera();
      });

      window.parent.document.getElementById('reset_camera_mobile').addEventListener('click', (e) => {
        this.ResetCamera();
      });

      window.parent.document.getElementById('email_design').addEventListener('click', (e) => {
        window.parent.parent.document.getElementById('visualiser-save-form').style.display = 'flex';
        
        this.EmailBuilding();
      });

      try {
        window.parent.parent.document.getElementById('visualiser-save-form-close').addEventListener('click', (e) => {
          e.preventDefault();

          window.parent.parent.document.getElementById('visualiser-save-form').style.display = 'none';
        });
      } catch (err) {
        
      }

      try {
        window.parent.parent.document.getElementById('ios-ar-popup-close').addEventListener('click', (e) => {
          e.preventDefault();

          self.ShowObject(self.GetObject('bgSphere'));
          self.HideObject(self.GetObject('Dome_Lythwood_Field'));

          window.parent.parent.document.getElementById('ios-ar-popup-container').style.display = 'none';
        });
      } catch (err) {
        
      }
    }

    UpdateActiveMenuItem(target, clearCategory = false) {
      if (!target) return;
      
      let parentEl = target.closest('.tab-content');

      if (clearCategory) {
        parentEl = target.closest('.w-tab-content');
        if (!parentEl) {
          parentEl = target.closest('.clear-tabs');
        }
      }
      parentEl.querySelectorAll('.active').forEach((item) => {
        item.classList.remove('active');
      });

      target.classList.add('active');
    }

    InitDoorTypes() {
      this.doorTypes = [
        { name: 'SM_BiFold_2_8', price: 2700 },
        { name: 'SM_BiFold_3_8', price: 3600 },
        { name: 'SM_French_2_3', price: 0 },
        { name: 'SM_French_2_8', price: 350 },
        { name: 'SM_French_3_8', price: 1000 },
        { name: 'SM_SlideFold_2_8', price: 1400 },
        { name: 'SM_SlideFold_3_8', price: 2300 },
        { name: 'SM_Sliding_2_3', price: 0 },
        { name: 'SM_Sliding_2_8', price: 350 },
        { name: 'SM_Sliding_3_8', price: 1000 },
        { name: 'SM_French_1_5', price: 0 }
      ];
      this.doorWidths = [5, 7, 4, 5, 7, 5, 7, 4, 5, 7, 2];
      this.currentDoor = this.doorTypes[7];
      this.doorWidth = this.doorWidths[7];
    }

    GenerateBuilding() {
      this.BuildFrontWalls();
      this.BuildBackWalls();
      this.BuildLeftWalls();
      this.BuildRightWalls();
      this.BuildRoof();
      this.BuildGutter();
      this.BuildDecking();
      this.BuildFloor();
      this.BuildWindow();

      this.GetObject('SM_Lozenge_a').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_Lozenge_b').parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject('SM_BiFold_2_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_BiFold_3_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_French_1_5').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_French_2_3').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_French_2_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_French_3_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_SlideFold_2_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_SlideFold_3_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_Sliding_2_3').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_Sliding_2_8').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_Sliding_3_8').parent = this.GetObject('SM_Deck_1a_Left1');
      
      this.buildingTypes.forEach((type) => {
        this.GetObject(`SM_${type}_Left_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Left_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

        this.GetObject(`SM_${type}_Right_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
        this.GetObject(`SM_${type}_Right_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      });

      this.GetObject(`SM_INSP_Gutter_Left_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Left_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject(`SM_INSP_Gutter_Right_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Gutter_Right_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject(`SM_TGO_Gutter_Left_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Left_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject(`SM_TGO_Gutter_Right_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO_Gutter_Right_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      
      this.GetObject(`SM_INSP_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_INSP_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_EDGE_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_EDGE_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_EXPR_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_EXPR_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO1_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO1_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO2_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO2_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO3_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO3_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO4_Deck_Left`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_TGO4_Deck_Right`).parent = this.GetObject('SM_Deck_1a_Left1');
      
      this.GetObject(`SM_Melamine_Left_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Left_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject(`SM_Melamine_Right_2_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_2_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_3_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_3_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_4_0`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_4_5`).parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject(`SM_Melamine_Right_5_0`).parent = this.GetObject('SM_Deck_1a_Left1');

      this.GetObject('SM_TGO_FullHeight_0_5').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_TGO_FullHeight_1_0').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('SM_TGO1_SideScreen').parent = this.GetObject('SM_Deck_1a_Left1');
      
      this.GetObject('SM_PanelLight').parent = this.GetObject('SM_Deck_1a_Left1');
      this.GetObject('areaLight1').parent = this.GetObject('SM_PanelLight');

      this.cornerPost.parent = this.GetObject('SM_Deck_1a_Left1');
      this.cornerPost2.parent = this.GetObject('SM_Deck_1a_Left1');
    }

    BuildFrontWalls() {
      let cloneWall;
      let melamineWall;
      let melamineWallB;
      let melamineCap;
      let melamineCapB;
      let skirting;
      let doorCap;
      for (let i = 0; i <= 20; i++) {
        if (i % 2 == 0) {
          cloneWall = this.CloneObject('SM_Wall_a');
        } else {
          cloneWall = this.CloneObject('SM_Wall_b');
        }
        cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');
        
        cloneWall.translateX(i * 0.5);

        this.frontWallMeshes.push(cloneWall);
        
        if (i % 2 == 0) {
          cloneWall = this.CloneObject('SM_Wall_Cap_a');
        } else {
          cloneWall = this.CloneObject('SM_Wall_Cap_b');
        }
        cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneWall.translateX(i * 0.5);

        this.frontWallCapMeshes.push(cloneWall);

        if (i % 2 == 0) {
          melamineWall = this.CloneObject('SM_Melamine_Wall_a');
          melamineWall.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWall.translateX((i * 0.5) + 0.5);

          melamineWallB = this.CloneObject('SM_Melamine_Wall_b');
          melamineWallB.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWallB.translateX(i * 0.5);

          this.frontWallMelamineMeshes.push([melamineWall, melamineWallB]);

          melamineCap = this.CloneObject('SM_Melamine_Wall_Cap_b');
          melamineCap.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineCap.translateX(i * 0.5);

          melamineCapB = this.CloneObject('SM_Melamine_Wall_Cap_a');
          melamineCapB.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineCapB.translateX((i + 1) * 0.5);

          this.frontWallMelamineCapMeshes.push([melamineCap, melamineCapB]);
        }

        skirting = this.CloneObject('SM_Skirting_Standard');
        skirting.parent = this.GetObject('SM_Deck_1a_Left1');
        skirting.translateX(i * 0.5);
        skirting.translateY(-0.03);

        doorCap = this.CloneObject('SM_Melamine_Wall_Door_Cap');
        doorCap.parent = this.GetObject('SM_Deck_1a_Left1');
        doorCap.translateX(i * 0.5);
        this.frontWallDoorCap.push(doorCap);
        
        this.frontWallSkirting.push(skirting);
      }
    }
    
    BuildBackWalls() {
      let cloneWall;
      let skirting;
      let melamineWall;
      let melamineWallB;
      for (let i = 0; i <= 20; i++) {
        if (i % 2 == 0) {
          cloneWall = this.CloneObject('SM_Wall_a');
        } else {
          cloneWall = this.CloneObject('SM_Wall_b');
        }
        cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneWall.translateX((i + 1) * 0.5);
        cloneWall.rotateY(180 * (Math.PI / 180));

        this.backWallMeshes.push(cloneWall);

        if (i % 2 == 0) {
          melamineWall = this.CloneObject('SM_Melamine_Wall_Back_a');
          melamineWall.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWall.translateX(0.5 + ((i * 0.5) - 0.5));
          melamineWall.rotateY(180 * (Math.PI / 180));

          melamineWallB = this.CloneObject('SM_Melamine_Wall_Back_b');
          melamineWallB.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWallB.translateX(0.5 + (i * 0.5));
          melamineWallB.rotateY(180 * (Math.PI / 180));

          this.backWallMelamineMeshes.push([melamineWall, melamineWallB]);
        }

        skirting = this.CloneObject('SM_Skirting_Standard');
        skirting.parent = this.GetObject('SM_Deck_1a_Left1');
        skirting.translateX((i + 1) * 0.5);
        skirting.translateY(-0.03);
        skirting.rotateY(180 * (Math.PI / 180));

        this.backWallSkirting.push(skirting);
      }

      cloneWall = this.CloneObject('SM_Wall_a');
      cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');
      cloneWall.rotateY(180 * (Math.PI / 180));
      this.backWallEndPanel = cloneWall;
    }
    
    BuildLeftWalls() {
      let cloneWall;
      let melamineWall;
      let melamineWallB;
      let skirting;
      for (let i = 0; i <= 10; i++) {
        if (i % 2 == 0) {
          cloneWall = this.CloneObject('SM_Wall_a');
        } else {
          cloneWall = this.CloneObject('SM_Wall_b');
        }
        cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneWall.translateZ((i + 1) * -0.5);
        cloneWall.rotateY(-90 * (Math.PI / 180));

        this.leftWallMeshes.push(cloneWall);

        if (i % 2 == 0) {
          melamineWall = this.CloneObject('SM_Melamine_Wall_a');
          melamineWall.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWall.translateX(0.01);
          melamineWall.translateZ((i + 1) * -0.5);
          melamineWall.rotateY(-90 * (Math.PI / 180));

          melamineWallB = this.CloneObject('SM_Melamine_Wall_b');
          melamineWallB.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWallB.translateX(0.01);
          melamineWallB.translateZ(i * -0.5);
          melamineWallB.rotateY(-90 * (Math.PI / 180));

          this.leftWallMelamineMeshes.push([melamineWall, melamineWallB]);
        }

        skirting = this.CloneObject('SM_Skirting_Standard');
        skirting.parent = this.GetObject('SM_Deck_1a_Left1');
        skirting.translateY(-0.03);
        skirting.translateZ((i + 1) * -0.5);
        skirting.rotateY(-90 * (Math.PI / 180));
        
        this.leftWallSkirting.push(skirting);
      }
      
      this.tgoLeftWallCap = this.CloneObject('SM_Wall_Cap_a');
      this.tgoLeftWallCap.parent = this.GetObject('SM_Deck_1a_Left1');
      this.tgoLeftWallCap.position.z = -0.5;
      this.tgoLeftWallCap.rotateY(-90 * (Math.PI / 180));

      this.tgoLeftWallCap2 = this.CloneObject('SM_Wall_Cap_b');
      this.tgoLeftWallCap2.parent = this.GetObject('SM_Deck_1a_Left1');
      this.tgoLeftWallCap2.position.z = -1;
      this.tgoLeftWallCap2.rotateY(-90 * (Math.PI / 180));

      this.cornerPost = this.CloneObject('SM_CornerPost');
      this.cornerPost2 = this.CloneObject('SM_CornerPost');
    }
    
    BuildRightWalls() {
      let cloneWall;
      let skirting;
      let melamineWall;
      let melamineWallB;
      for (let i = 0; i <= 10; i++) {
        if (i % 2 == 0) {
          cloneWall = this.CloneObject('SM_Wall_a');
        } else {
          cloneWall = this.CloneObject('SM_Wall_b');
        }
        cloneWall.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneWall.translateZ(i * -0.5);
        cloneWall.rotateY(90 * (Math.PI / 180));
        
        this.rightWallMeshes.push(cloneWall);

        if (i % 2 == 0) {
          melamineWall = this.CloneObject('SM_Melamine_Wall_a');
          melamineWall.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWall.translateX((this.buildingWidth * 0.05) - 0.01);
          melamineWall.translateZ((i * -0.5) + 0.5);
          melamineWall.rotateY(90 * (Math.PI / 180));

          melamineWallB = this.CloneObject('SM_Melamine_Wall_b');
          melamineWallB.parent = this.GetObject('SM_Deck_1a_Left1');
          melamineWallB.translateX((this.buildingWidth * 0.05) - 0.01);
          melamineWallB.translateZ(i * -0.5);
          melamineWallB.rotateY(90 * (Math.PI / 180));  

          this.rightWallMelamineMeshes.push([melamineWall, melamineWallB]);
        }

        skirting = this.CloneObject('SM_Skirting_Standard');
        skirting.parent = this.GetObject('SM_Deck_1a_Left1');
        skirting.translateY(-0.03);
        skirting.translateZ(i * -0.5);
        skirting.rotateY(90 * (Math.PI / 180));

        this.rightWallSkirting.push(skirting);
      }
    }
    
    BuildRoof() {
      for (let i = 0; i < this.buildingTypes.length; i++) {
        this.roofMeshBuildingTypes.push(this.BuildRoofBuildingType(this.buildingTypes[i]));
      }

      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_2_0_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_2_5_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_3_0_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_3_5_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_4_0_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_4_5_a'));
      this.melamineCeilings.push(this.BuildMelamineCeilingSize('SM_Melamine_Mid_5_0_a'));
    }

    BuildMelamineCeilingSize(ceilingMesh) {
      let meshes = [];
      for (let i = 0; i < 20; i++) {
        let mesh = this.CloneObject(ceilingMesh);
        mesh.parent = this.GetObject('SM_Deck_1a_Left1');
        mesh.translateX(i * 0.5);
        meshes.push(mesh);
      }

      return meshes;
    }

    BuildRoofBuildingType(buildingType) {
      let roofMeshes = [];

      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_2_0_a`, `SM_${buildingType}_Mid_2_0_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_2_5_a`, `SM_${buildingType}_Mid_2_5_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_3_0_a`, `SM_${buildingType}_Mid_3_0_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_3_5_a`, `SM_${buildingType}_Mid_3_5_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_4_0_a`, `SM_${buildingType}_Mid_4_0_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_4_5_a`, `SM_${buildingType}_Mid_4_5_b`));
      roofMeshes.push(this.BuildRoofSize(`SM_${buildingType}_Mid_5_0_a`, `SM_${buildingType}_Mid_5_0_b`));
      
      return roofMeshes;
    }

    BuildRoofSize(roofMesh, roofMeshAlt) {
      let cloneRoof;
      let tempRoofList = [];

      for (let j = 0; j <= 18; j++) {
        if (j % 2 == 0) {
          cloneRoof = this.CloneObject(roofMeshAlt);
        } else {
          cloneRoof = this.CloneObject(roofMesh);
        }
        cloneRoof.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneRoof.translateX(j * 0.5);

        tempRoofList.push(cloneRoof);
      }
      
      return tempRoofList;
    }
    
    BuildGutter() {
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_2_0'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_2_5'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_3_0'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_3_5'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_4_0'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_4_5'));
      this.gutterMeshes.push(this.BuildGutterSize('SM_INSP_Gutter_Mid_5_0'));
    }

    BuildGutterSize(gutterMesh) {
      let cloneGutter;
      let tempGutterList = [];

      for (let i = 0; i <= 20; i++) {
        cloneGutter = this.CloneObject(gutterMesh);
        cloneGutter.parent = this.GetObject('SM_Deck_1a_Left1');
        cloneGutter.translateX(i * 0.5);

        tempGutterList.push(cloneGutter);
      }
      
      return tempGutterList;
    }
    
    BuildDecking() {
      this.deckMeshes.push(this.BuildDeckingSize('SM_INSP_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_EXPR_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_EDGE_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_EXPR_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_TGO1_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_TGO2_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_TGO3_Deck_Mid'));
      this.deckMeshes.push(this.BuildDeckingSize('SM_TGO4_Deck_Mid'));
    }

    BuildDeckingSize(deckMesh) {
      let cloneDeck;
      let tempDeckList = [];
      
      for (let i = 0; i <= 18; i++) {
        cloneDeck = this.CloneObject(deckMesh);
        cloneDeck.parent = this.GetObject('SM_Deck_1a_Left1');

        cloneDeck.translateX(i * 0.5);

        tempDeckList.push(cloneDeck);
      }
      
      return tempDeckList;
    }
    
    BuildFloor() {
      this.floorMeshDepths.push(this.BuildFloorDepth('2_0'));
      this.floorMeshDepths.push(this.BuildFloorDepth('2_5'));
      this.floorMeshDepths.push(this.BuildFloorDepth('3_0'));
      this.floorMeshDepths.push(this.BuildFloorDepth('3_5'));
      this.floorMeshDepths.push(this.BuildFloorDepth('4_0'));
      this.floorMeshDepths.push(this.BuildFloorDepth('4_5'));
      this.floorMeshDepths.push(this.BuildFloorDepth('5_0'));
    }
    
    BuildWindow() {
      this.window = this.GetObject('SM_Lozenge_a');
      this.window.position.x = this.buildingWidth * 0.5;
      this.window.position.z = -1;
      this.window.rotateY(90 * (Math.PI / 180));
    }

    BuildFloorDepth(depth) {
      let cloneFloor;
      let tempFloor;
      let tempFloorList = [];

      for (let i = 0; i <= 20; i++) {
        if (i % 2 == 0) {
          tempFloor = 'SM_Floor_a_' + String(depth);
        } else {
          tempFloor = 'SM_Floor_b_' + String(depth);
        }
        
        cloneFloor = this.CloneObject(tempFloor);
        cloneFloor.parent = this.GetObject('SM_Deck_1a_Left1');
        cloneFloor.position.x = (i * 0.5) + 0.25;
        cloneFloor.position.y = 0.05;

        tempFloorList.push(cloneFloor);
      }
      
      return tempFloorList;
    }

    ChangeCurrentBuilding(building) {
      this.currentBuilding = building;
      this.currentCladding = 'Redwood';
      
      for (let i = 0; i <= 7; i++) {
        if (this.currentBuilding == this.buildingTypes[i]) {
          this.currentRoofMeshes = this.roofMeshBuildingTypes[i];

          break;
        }
      }
      
      this.UpdateBuildingSpecificDefaults();
      
      this.UpdateMaterials();
      this.UpdateBuilding();
    }

    UpdateBuildingSpecificDefaults() {
      if (this.currentBuilding != 'PINN') {
        this.buildingRange = 'TGO';

        this.currentDeckCladding = 'Grey';
        this.blackHood = true;
        this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_black'), true);
        window.parent.document.getElementById('hood_natural').style.display = 'none';
      } else if (this.currentBuilding === 'EDGE') {
        this.buildingRange = 'GR';
        this.currentDeckCladding = 'Black';
        this.blackHood = true;
        window.parent.document.getElementById('hood_natural').style.display = 'block';
        this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_black'), true);
      } else {
        this.buildingRange = 'GR';

        this.currentDeckCladding = 'Redwood';
        this.blackHood = false;
        window.parent.document.getElementById('hood_natural').style.display = 'block';
        this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_natural'), true);
      }
    }
  
    UpdateBuilding() {
      this.HideAllObjects();

      this.ShowObject(this.GetObject('SM_PanelLight'));
      this.ShowObject(this.GetObject('areaLight1'));

      this.UpdateDoor();
      this.UpdateBuildingWidth();
      this.UpdateBuildingDepth();
      this.UpdateBackWalls();
      this.UpdateLeftWalls();
      this.UpdateRightWalls();
      this.UpdateRoof();
      this.UpdateGutter();
      this.UpdateDecking();
      this.UpdateFloor();
      this.UpdateWindow();
      this.UpdateGarden();
      this.UpdateUI();

      this.GetObject('SM_PanelLight').position.x = ((this.buildingWidth - 3) / 2) * 0.5;
      this.GetObject('SM_PanelLight').position.y = -this.buildingDepth / 100;
      this.GetObject('SM_PanelLight').position.z = ((-this.buildingDepth / 2) * 0.5) + 1;
      this.GetObject('SM_Deck_1a_Left1').position.x = 3.25 + (this.buildingWidth / 2) * -0.5;
      // this.GetObject('SM_Deck_1a_Left1').position.y = -3;

      if (this.debugMode) {
        app.printPerformanceInfo();
      }

      console.log(this.SaveBuilding());
    }
    
    UpdateBuildingWidth() {
      if (this.currentBuilding !== 'INSP' && this.buildingWidth == 4) {
        this.buildingWidth = 5;
      }
      
      switch (this.buildingWidth) {
        case 13:
          window.parent.document.getElementById('depth_slider').max = 9;
          if (this.buildingDepth >= 9) {
            window.parent.document.getElementById('depth_slider').value = 9;
            this.buildingDepth = 9;
          }
          break;
        case 14:
          window.parent.document.getElementById('depth_slider').max = 8;
          if (this.buildingDepth >= 8) {
            window.parent.document.getElementById('depth_slider').value = 8;
            this.buildingDepth = 8;
          }
          break;
        case 15:
          window.parent.document.getElementById('depth_slider').max = 8;
          if (this.buildingDepth >= 8) {
            window.parent.document.getElementById('depth_slider').value = 8;
            this.buildingDepth = 8;
          }
          break;
        case 16:
          window.parent.document.getElementById('depth_slider').max = 7;
          if (this.buildingDepth >= 7) {
            window.parent.document.getElementById('depth_slider').value = 7;
            this.buildingDepth = 7;
          }
          break;
        case 17:
          window.parent.document.getElementById('depth_slider').max = 7;
          if (this.buildingDepth >= 7) {
            window.parent.document.getElementById('depth_slider').value = 7;
            this.buildingDepth = 7;
          }
          break;
        case 18:
          window.parent.document.getElementById('depth_slider').max = 6;
          if (this.buildingDepth >= 6) {
            window.parent.document.getElementById('depth_slider').value = 6;
            this.buildingDepth = 6;
          }
          break;
        case 19:
          window.parent.document.getElementById('depth_slider').max = 6;
          if (this.buildingDepth >= 6) {
            window.parent.document.getElementById('depth_slider').value = 6;
            this.buildingDepth = 6;
          }
          break;
        case 20:
          window.parent.document.getElementById('depth_slider').max = 6;
          if (this.buildingDepth >= 6) {
            window.parent.document.getElementById('depth_slider').value = 6;
            this.buildingDepth = 6;
          }
          break;
        default:
          window.parent.document.getElementById('depth_slider').max = 10;
          break;
      }
      
      for (let i = 0; i < this.buildingWidth; i++) {
        if (i < this.doorPosition || i > parseInt(this.doorPosition) + this.doorWidth) {
          this.ShowObject(this.frontWallMeshes[i]);
          this.ShowObject(this.frontWallCapMeshes[i]);
        }

        this.ShowObject(this.frontWallSkirting[i]);

        if (i != this.buildingWidth - 1 || i % 2 == 0) {
          this.ShowObject(this.backWallMeshes[i]);
        } else {
          this.backWallEndPanel.position.x = this.buildingWidth * 0.5;
          this.backWallEndPanel.position.z = this.buildingDepth * -0.5;
          this.ShowObject(this.backWallEndPanel);
        }

        if (this.currentInterior == 'Melamine') {
          if (i < this.buildingWidth / 2) {
            this.ShowObject(this.backWallMelamineMeshes[i][0]);
            this.ShowObject(this.backWallMelamineMeshes[i][1]);

            this.ShowObject(this.frontWallMelamineMeshes[i][0]);
            this.ShowObject(this.frontWallMelamineMeshes[i][1]);

            this.ShowObject(this.frontWallMelamineCapMeshes[i][0]);
            this.ShowObject(this.frontWallMelamineCapMeshes[i][1]);
          }

          if (i >= this.doorPosition && i <= parseInt(this.doorPosition) + this.doorWidth) {
            this.HideObject(this.frontWallMelamineCapMeshes[Math.floor(i / 2)][0]);
            this.HideObject(this.frontWallMelamineCapMeshes[Math.floor(i / 2)][1]);
            
            this.HideObject(this.frontWallMelamineMeshes[Math.floor(i / 2)][0]);
            this.HideObject(this.frontWallMelamineMeshes[Math.floor(i / 2)][1]);
          }
          
          if (i >= this.doorPosition && i <= parseInt(this.doorPosition) + this.doorWidth) {
            if (i > 0) {
              this.ShowObject(this.frontWallDoorCap[i - 1]);
            }

            this.ShowObject(this.frontWallDoorCap[i]);

            if (i < this.buildingWidth - 1) {
              this.ShowObject(this.frontWallDoorCap[i + 1]);
            }
          }
        }

        this.ShowObject(this.backWallSkirting[i]);

        if (this.buildingRange === 'TGO' && this.doorPosition === 0) {
          this.ShowObject(this.cornerPost);
        }

        if (this.buildingRange === 'TGO' && this.currentBuilding === 'TGO1' && (this.doorPosition + this.doorWidth) >= this.buildingWidth - 1) {
          this.cornerPost2.position.x = this.buildingWidth * 0.5;
          this.cornerPost2.scale.x = -1;
          this.ShowObject(this.cornerPost2);
        }
      }

      if (this.buildingWidth / 2 % 1 == 0.5) {
        this.HideObject(this.frontWallMelamineMeshes[Math.floor(this.buildingWidth / 2)][0]);
        this.HideObject(this.frontWallMelamineCapMeshes[Math.floor(this.buildingWidth / 2)][1]);
      }

      if (this.currentBuilding === 'TGO1' && this.tgoScreen) {
        this.ShowObject(this.GetObject('SM_TGO1_SideScreen'));
        this.GetObject('SM_TGO1_SideScreen').position.x = (this.buildingWidth - 3) * 0.5;
      } else {
        this.HideObject(this.GetObject('SM_TGO1_SideScreen'));
      }
    }
    
    UpdateBuildingDepth() {
      for (let i = 0; i < this.buildingDepth; i++) {        
        this.ShowObject(this.leftWallMeshes[i]);

        if (this.currentInterior == 'Melamine') {
          if (i < this.buildingDepth / 2) {
            this.ShowObject(this.leftWallMelamineMeshes[i][0]);
            this.ShowObject(this.leftWallMelamineMeshes[i][1]);

            this.ShowObject(this.rightWallMelamineMeshes[i][0]);
            this.ShowObject(this.rightWallMelamineMeshes[i][1]);
          }
        }

        if (i == 0) {
          if (this.buildingRange == 'TGO') {
            if (this.tgoFullHeightWindow > 0) {
              this.HideObject(this.leftWallMeshes[i]);
            }
          }
        }

        if (i == 1) {
          if (this.buildingRange == 'TGO') {
            if (this.tgoFullHeightWindow === 2) {
              this.HideObject(this.leftWallMeshes[i]);
            }
          }
        }

        if (i < 2 || i > 3) {
          this.ShowObject(this.rightWallMeshes[i]);
        }

        this.ShowObject(this.leftWallSkirting[i]);
        this.ShowObject(this.rightWallSkirting[i]);
      }
    }
    
    UpdateBackWalls() {
      for (let i = 0; i < this.buildingWidth; i++) {
        this.backWallMeshes[i].position.z = this.buildingDepth * -0.5;
        this.backWallSkirting[i].position.z = this.buildingDepth * -0.5;
      }
    }
    
    UpdateLeftWalls() {
      if (this.buildingDepth == 4) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_2_0`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_2_0`));
        }
      }
      if (this.buildingDepth == 5) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_2_5`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_2_5`));
        }
      }
      if (this.buildingDepth == 6) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_3_0`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_3_0`));
        }
      }
      if (this.buildingDepth == 7) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_3_5`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_3_5`));
        }
      }
      if (this.buildingDepth == 8) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_4_0`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_4_0`));
        }
      }
      if (this.buildingDepth == 9) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_4_5`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_4_5`));
        }
      }
      if (this.buildingDepth == 10) {
        this.ShowObject(this.GetObject(`SM_${this.currentBuilding}_Left_5_0`));
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Left_5_0`));
        }
      }

      if (this.buildingRange == 'TGO') {
        if (this.tgoFullHeightWindow == 1) {
          this.ShowObject(this.GetObject('SM_TGO_FullHeight_0_5'));
          this.ShowObject(this.tgoLeftWallCap2);
        } else if (this.tgoFullHeightWindow == 2) {
          this.ShowObject(this.GetObject('SM_TGO_FullHeight_1_0'));
        } else {
          this.ShowObject(this.tgoLeftWallCap);
          this.ShowObject(this.tgoLeftWallCap2);
        }
      } else {
        this.HideObject(this.tgoLeftWallCap);
        this.HideObject(this.tgoLeftWallCap2);
      }

      if (this.currentInterior == 'Melamine') {
        for (let i = 0; i < this.backWallMelamineMeshes.length; i++) {
          this.backWallMelamineMeshes[i][0].position.z = (this.buildingDepth * -0.5) + 0.01;
          this.backWallMelamineMeshes[i][1].position.z = (this.buildingDepth * -0.5) + 0.01;
        }
      }
    }
    
    UpdateRightWalls() {
      if (this.buildingDepth == 4) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_2_0`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_2_0`));
          this.GetObject(`SM_Melamine_Right_2_0`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 5) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_2_5`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_2_5`));
          this.GetObject(`SM_Melamine_Right_2_5`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 6) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_3_0`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_3_0`));
          this.GetObject(`SM_Melamine_Right_3_0`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 7) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_3_5`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_3_5`));
          this.GetObject(`SM_Melamine_Right_3_5`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 8) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_4_0`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_4_0`));
          this.GetObject(`SM_Melamine_Right_4_0`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 9) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_4_5`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_4_5`));
          this.GetObject(`SM_Melamine_Right_4_5`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }
      if (this.buildingDepth == 10) {
        this.rightWallDepthMesh = this.GetObject(`SM_${this.currentBuilding}_Right_5_0`);
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.GetObject(`SM_Melamine_Right_5_0`));
          this.GetObject(`SM_Melamine_Right_5_0`).position.x = (this.buildingWidth - 3) * 0.5;
        }
      }

      for (let i = 0; i < this.rightWallMeshes.length; i++) {
        this.rightWallMeshes[i].position.x = this.buildingWidth * 0.5;
      }
      this.rightWallDepthMesh.position.x = (this.buildingWidth - 3) * 0.5;
      this.ShowObject(this.rightWallDepthMesh);

      for (let i = 0; i < this.rightWallSkirting.length; i++) {
        this.rightWallSkirting[i].position.x = this.buildingWidth * 0.5;
      }

      if (this.currentInterior == 'Melamine') {
        for (let i = 0; i < this.rightWallMelamineMeshes.length; i++) {
          this.rightWallMelamineMeshes[i][0].position.x = this.buildingWidth * 0.5;
          this.rightWallMelamineMeshes[i][1].position.x = this.buildingWidth * 0.5;
        }
      }
    }
    
    UpdateRoof() {
      for (let i = 0; i <= 7; i++) {
        if (this.currentBuilding == this.buildingTypes[i]) {
          this.currentRoofMeshes = this.roofMeshBuildingTypes[i];
          break;
        }
      }
      
      if (this.buildingDepth == 4) {
        this.currentRoofMesh = this.currentRoofMeshes[0];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[0];
      }
      if (this.buildingDepth == 5) {
        this.currentRoofMesh = this.currentRoofMeshes[1];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[1];
      }
      if (this.buildingDepth == 6) {
        this.currentRoofMesh = this.currentRoofMeshes[2];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[2];
      }
      if (this.buildingDepth == 7) {
        this.currentRoofMesh = this.currentRoofMeshes[3];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[3];
      }
      if (this.buildingDepth == 8) {
        this.currentRoofMesh = this.currentRoofMeshes[4];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[4];
      }
      if (this.buildingDepth == 9) {
        this.currentRoofMesh = this.currentRoofMeshes[5];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[5];
      }
      if (this.buildingDepth == 10) {
        this.currentRoofMesh = this.currentRoofMeshes[6];
        this.currentCeilingMelamineMeshes = this.melamineCeilings[6];
      }

      for (let i = 0; i < this.buildingWidth - 2; i++) {
        this.ShowObject(this.currentRoofMesh[i]);
        
        if (this.currentInterior == 'Melamine') {
          this.ShowObject(this.currentCeilingMelamineMeshes[i]);
        }
      }
    }
    
    UpdateGutter() {
      if (this.currentBuilding == 'EXPR' || this.currentBuilding == 'TGO1') {
        this.currentGutterRange = 'TGO';
      } else {
        this.currentGutterRange = 'INSP';
      }
      
      if (this.buildingDepth == 4) {
        this.currentGutterMeshes = this.gutterMeshes[0];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_2_0`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_2_0`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_2_0`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 5) {
        this.currentGutterMeshes = this.gutterMeshes[1];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_2_5`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_2_5`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_2_5`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 6) {
        this.currentGutterMeshes = this.gutterMeshes[2];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_3_0`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_3_0`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_3_0`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 7) {
        this.currentGutterMeshes = this.gutterMeshes[3];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_3_5`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_3_5`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_3_5`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 8) {
        this.currentGutterMeshes = this.gutterMeshes[4];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_4_0`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_4_0`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_4_0`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 9) {
        this.currentGutterMeshes = this.gutterMeshes[5];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_4_5`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_4_5`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_4_5`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      if (this.buildingDepth == 10) {
        this.currentGutterMeshes = this.gutterMeshes[6];
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Left_5_0`));
        this.ShowObject(this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_5_0`));
        
        this.GetObject(`SM_${this.currentGutterRange}_Gutter_Right_5_0`).position.x = (this.buildingWidth - 3) * 0.5;
      }
      
      for (let i = 0; i < this.buildingWidth - 2; i++) {
        this.ShowObject(this.currentGutterMeshes[i]);
      }
    }
    
    UpdateDecking() {
      this.currentDeck = this.currentBuilding;
      
      for (let i = 0; i <= 7; i++) {
        if (this.currentDeck == this.buildingTypes[i]) {
          this.currentDeckMeshes = this.deckMeshes[i];

          break;
        }
      }
      if (this.currentDeck == 'PINN') {
        this.currentDeck = 'EXPR';
      }
      
      this.ShowObject(this.GetObject(`SM_${this.currentDeck}_Deck_Left`));
      this.ShowObject(this.GetObject(`SM_${this.currentDeck}_Deck_Right`));
      this.GetObject(`SM_${this.currentDeck}_Deck_Right`).position.x = (this.buildingWidth - 3) * 0.5;

      for (let i = 0; i < this.buildingWidth - 2; i++) {
        this.ShowObject(this.currentDeckMeshes[i]);
      }
    }
    
    UpdateDoor() {
      let door = this.GetObject(this.currentDoor.name);

      if (this.doorPosition > this.buildingWidth - this.doorWidth - 1) {
        this.doorPosition = this.buildingWidth - this.doorWidth - 1;
      }

      if (this.doorWidth > this.buildingWidth) {
        this.buildingWidth = this.doorWidth + 1;
      }
      
      if (this.doorPosition < 0) {
        this.doorPosition = 0;
      }
      
      door.position.x = this.doorPosition * 0.5;
    
      this.ShowObject(door);
    }
    
  UpdateFloor() {
      if (this.buildingDepth == 4) {
        this.floorMeshes = this.floorMeshDepths[0];
      }
      if (this.buildingDepth == 5) {
        this.floorMeshes = this.floorMeshDepths[1];
      }
      if (this.buildingDepth == 6) {
        this.floorMeshes = this.floorMeshDepths[2];
      }
      if (this.buildingDepth == 7) {
        this.floorMeshes = this.floorMeshDepths[3];
      }
      if (this.buildingDepth == 8) {
        this.floorMeshes = this.floorMeshDepths[4];
      }
      if (this.buildingDepth == 9) {
        this.floorMeshes = this.floorMeshDepths[5];
      }
      if (this.buildingDepth == 10) {
        this.floorMeshes = this.floorMeshDepths[6];
      }

      for (let i = 0; i < this.buildingWidth; i++) {
        this.ShowObject(this.floorMeshes[i]);
      }
    }

    UpdateWindow() {
      this.window.position.x = this.buildingWidth * 0.5;
      
      this.ShowObject(this.window);
    }
    
    UpdateMaterials() {
      if (this.currentCladding == 'Redwood_Slatted' ||
          this.currentCladding == 'Honey_Slatted' ||
          this.currentCladding == 'Cedar_Slatted' ||
          this.currentCladding == 'Composite_Grey')
        {
          let claddingName = '';
          switch (this.currentCladding) {
            case "Redwood_Slatted":
              claddingName = "Redwood Slatted";
              break;
            case "Honey_Slatted":
              claddingName = "Honey Slatted";
              break;
            case "Cedar_Slatted":
              claddingName = "Cedar Slatted";
              break;
            case "Composite_Grey":
              claddingName = "Grey";
              break;
          }
          
          let notificationEl = window.parent.document.querySelector('#v-notification');
          notificationEl.innerHTML = `<p>We've refreshed our cladding options meaning your selected <strong>${claddingName}</strong> cladding is no longer available. We've changed your building to our standard Redwood cladding but make sure you explore our new cladding styles.</p><small>Click to dismiss message</small>`;
          notificationEl.style.display = 'block';
          notificationEl.addEventListener('click', (e) => {
            e.currentTarget.style.display = 'none';
          });
          this.currentCladding = 'Redwood';
        }
      
      if (this.currentBuilding === 'TGO4') {
        this.buildingRange = 'TGO';

        if (this.currentCladding === 'Cedar' || this.currentCladding === 'Cedar_Premium' || this.currentCladding === 'Cedar_Slatted') {
          window.parent.document.getElementById('hood_natural').style.display = 'block';
        } else {
          this.blackHood = true;
          this.UpdateActiveMenuItem(window.parent.document.getElementById('hood_black'), true);
          window.parent.document.getElementById('hood_natural').style.display = 'none';
        }
      }
      
      if (this.currentCladding == 'Cedar') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Cedar_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Cedar_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Cedar_Premium') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Cedar_PRM_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Cedar_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_PRM_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_PRM_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Composite_Cedar') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Composite_Cedar_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Composite_Oak_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Composite_Oak') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Composite_Oak_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Composite_Oak_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Oak_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Oak_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Composite_Grey') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Composite_Grey_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Composite_Oak_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Grey_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_Grey_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_Oak_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Redwood') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Redwood_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Redwood_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Redwood_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Redwood_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          console.log("BLACK FASCIA");
          
          let materials = [];
          app.scene.traverse((object) => {
            if (object.material) {
              if (!materials.includes(object.material)) {
                materials.push(object.material);
              }
            }
          });

          materials.forEach((material) => {
            console.log(material);
          });
          
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Redwood_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Redwood_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Honey') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Honey_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Redwood_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Honey_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Redwood_N.jpg', function() {});
        }
        
        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Honey_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Redwood_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Composite') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Composite_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Composite_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Composite_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Redwood_Slatted') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Redwood_Slatted_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Redwood_Slatted_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {0
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Redwood_Slatted_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Redwood_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Redwood_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Redwood_N_V_Tile.jpg', function() {});
        }
      }
      
      if (this.currentCladding == 'Honey_Slatted') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Honey_Slatted_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Redwood_Slatted_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Honey_Slatted_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Redwood_Slatted_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Honey_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Redwood_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentCladding == 'Cedar_Slatted') {
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_D_1', './Cedar_Slatted_D.jpg', function() {});
        this.ReplaceTexture('M_Clad_Cedar', 'Cedar_N_1', './Redwood_Slatted_N.jpg', function() {});

        if (this.currentBuilding == 'TGO4' && !this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Cedar_N.jpg', function() {});
        } else if (!this.blackHood) {
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Cedar_Slatted_D.jpg', function() {});
          this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Redwood_Slatted_N.jpg', function() {});
        }

        if (this.currentFascia == 'Black') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Composite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else if (this.currentFascia == 'Graphite') {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Graphite_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Composite_N_V_Tile.jpg', function() {});
        } else {
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_D_V_Tile_1', './Cedar_D_V_Tile.jpg', function() {});
          this.ReplaceTexture('M_Clad_Cedar_VTILE', 'Cedar_N_V_Tile_1', './Cedar_N_V_Tile.jpg', function() {});
        }
      }

      if (this.currentDeckCladding == 'Cedar') {
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_D_1', './Decking_Cedar_D.jpg', function() {});
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_N_1', './Decking_Cedar_N.jpg', function() {});
      }

      if (this.currentDeckCladding == 'Redwood') {
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_D_1', './Decking_Redwood_D.jpg', function() {});
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_N_1', './Decking_Cedar_N.jpg', function() {});
      }

      if (this.currentDeckCladding == 'Honey') {
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_D_1', './Decking_Honey_D.jpg', function() {});
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_N_1', './Decking_Cedar_N.jpg', function() {});
      }

      if (this.currentDeckCladding == 'Black') {
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_D_1', './Decking_CompositeBlack_D.jpg', function() {});
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_N_1', './Decking_Composite_N.jpg', function() {});
      }

      if (this.currentDeckCladding == 'Grey') {
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_D_1', './Decking_CompositeGrey_D.jpg', function() {});
        this.ReplaceTexture('M_Deck_Composite', 'Decking_Composite_N_1', './Decking_Composite_N.jpg', function() {});
      }

      if (this.currentFloor == 'Grey') {
        this.ReplaceTexture('M_Laminate', 'Laminate_Grey_D_1', './Laminate_Grey_D.jpg', function() {});
      }

      if (this.currentFloor == 'Oak') {
        this.ReplaceTexture('M_Laminate', 'Laminate_Grey_D_1', './Laminate_Oak_D.jpg', function() {});
      }

      if (this.currentFloor == 'White') {
        this.ReplaceTexture('M_Laminate', 'Laminate_Grey_D_1', './Laminate_DarkOak_D.jpg', function() {});
      }

      if (this.currentFascia == 'Graphite') {
        this.SetMaterialColor('M_Trim_Colour', 'color', 0.035, 0.053, 0.060, '');
      } else if (this.currentFascia == 'Black') {
        this.SetMaterialColor('M_Trim_Colour', 'color', .02, .02, 0.02, '');
      } 
    
      if (this.blackHood || this.currentCladding.includes('Composite')) {
        this.ReplaceTexture('M_Clad_Hood', 'Cedar_D_2', './Composite_D_V_Tile.jpg', function() {});
        this.ReplaceTexture('M_Clad_Hood', 'Cedar_N_2', './Blank_N.jpg', function() {});
      }
    }
    
    UpdateUI() {
      let widthArrowDecrease = window.parent.document.querySelectorAll('.widthblock-mobile .arrow-width-left')[0];
      let widthArrowIncrease = window.parent.document.querySelectorAll('.widthblock-mobile .arrow-width-right')[0];
      let depthArrowDecrease = window.parent.document.querySelectorAll('.depthblock-mobile .arrow-width-left')[0];
      let depthArrowIncrease = window.parent.document.querySelectorAll('.depthblock-mobile .arrow-width-right')[0];
      
      widthArrowDecrease.style.opacity = 1;
      widthArrowIncrease.style.opacity = 1;
      if (this.buildingWidth <= 4) {
        widthArrowDecrease.style.opacity = 0.2;
      }
      if (this.buildingWidth >= 20) {
        widthArrowIncrease.style.opacity = 0.2;
      }

      depthArrowDecrease.style.opacity = 1;
      depthArrowIncrease.style.opacity = 1;
      if (this.buildingDepth <= 5) {
        depthArrowDecrease.style.opacity = 0.2;
      }
      if (this.buildingDepth >= 10) {
        depthArrowIncrease.style.opacity = 0.2;
      }

      switch (this.buildingWidth) {
        case 13:
          if (this.buildingDepth >= 9) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 14:
          if (this.buildingDepth >= 8) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 15:
          if (this.buildingDepth >= 8) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 16:
          if (this.buildingDepth >= 7) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 17:
          if (this.buildingDepth >= 7) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 18:
          if (this.buildingDepth >= 6) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 19:
          if (this.buildingDepth >= 6) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        case 20:
          if (this.buildingDepth >= 6) {
            depthArrowIncrease.style.opacity = 0.2;
          }
          break;
        default:
          depthArrowIncrease.style.opacity = 1;
          break;
      }

      window.parent.document.getElementById('width_number').innerText = this.buildingWidth / 2 + 'm';
      window.parent.document.getElementById('width_number_mobile').innerText = this.buildingWidth / 2 + 'm';
      window.parent.document.getElementById('depth_number').innerText = this.buildingDepth / 2 + 'm';
      window.parent.document.getElementById('depth_number_mobile').innerText = this.buildingDepth / 2 + 'm';

      let width_slider = window.parent.document.getElementById('width_slider');
      if (this.currentBuilding === 'INSP' && this.currentDoor == this.doorTypes[10]) {
        width_slider.min = 4;
      } else {
        width_slider.min = Math.max(this.doorWidth + 1, 5);

        if (width_slider.value < this.doorWidth) {
          width_slider.value = this.doorWidth;
        }
      }

      if (this.buildingRange == 'TGO' || this.currentCladding == 'Composite' || this.currentCladding == 'Composite_Cedar' || this.currentCladding == 'Composite_Oak' || this.currentCladding == 'Composite_Grey') {
        window.parent.document.getElementById('fascia_natural').style.display = 'none';
      } else {
        window.parent.document.getElementById('fascia_natural').style.display = 'block';
      }

      if (this.buildingRange == 'GR') {
        window.parent.document.getElementById('fhwindow_container').style.display = 'none';
      } else {
        window.parent.document.getElementById('fhwindow_container').style.display = 'flex';
      }
      
      // Update active UI states
      if (this.currentBuilding == 'EXPR') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_expression'), true);
      }

      if (this.currentBuilding == 'INSP') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_inspiration'), true);
      }

      if (this.currentBuilding == 'EDGE') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_edge'), true);
      }

      if (this.currentBuilding == 'PINN') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_pinnacle'), true);
      }

      if (this.currentBuilding == 'TGO1') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_tgo1'), true);
      }

      if (this.currentBuilding == 'TGO2') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_tgo2'), true);
      }

      if (this.currentBuilding == 'TGO3') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_tgo3'), true);
      }

      if (this.currentBuilding == 'TGO4') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('model_tgo4'), true);
      }

      if (this.currentCladding == 'Redwood') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_redwood'), true);
      }

      if (this.currentCladding == 'Honey') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_honey'));
      }

      if (this.currentCladding == 'Cedar') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_cedarstd'));
      }

      if (this.currentCladding == 'Redwood_Slatted') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_redwoodslatted'));
      }

      if (this.currentCladding == 'Honey_Slatted') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_honeyslatted'));
      }

      if (this.currentCladding == 'Cedar_Slatted') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_cedarslatted'));
      }

      if (this.currentCladding == 'Composite') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('cladding_black'));
      }

      if (this.currentDeckCladding == 'Redwood') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_redwood'));
      }

      if (this.currentDeckCladding == 'Honey') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_honey'));
      }

      if (this.currentDeckCladding == 'Cedar') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_cedar'));
      }

      if (this.currentDeckCladding == 'Black') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_black'));
      }

      if (this.currentDeckCladding == 'Grey') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('deck_grey'));
      }

      if (this.currentDoor == this.doorTypes[0]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_bifold28'), true);
        window.parent.document.getElementById('door_28').click();
      }

      if (this.currentDoor == this.doorTypes[1]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_bifold38'), true);
        window.parent.document.getElementById('door_38').click();
      }

      if (this.currentDoor == this.doorTypes[2]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_french23'), true);
        window.parent.document.getElementById('door_23').click();
      }

      if (this.currentDoor == this.doorTypes[3]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_french28'), true);
        window.parent.document.getElementById('door_28').click();
      }
      
      if (this.currentDoor == this.doorTypes[4]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_french38'), true);
        window.parent.document.getElementById('door_38').click();
      }

      if (this.currentDoor == this.doorTypes[5]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_slidefold28'), true);
        window.parent.document.getElementById('door_28').click();
      }

      if (this.currentDoor == this.doorTypes[6]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_slidefold38'), true);
        window.parent.document.getElementById('door_38').click();
      }

      if (this.currentDoor == this.doorTypes[7]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_sliding23'), true);
        window.parent.document.getElementById('door_23').click();
      }

      if (this.currentDoor == this.doorTypes[8]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_sliding28'), true);
        window.parent.document.getElementById('door_28').click();
      }

      if (this.currentDoor == this.doorTypes[9]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_sliding38'), true);
        window.parent.document.getElementById('door_38').click();
      }

      if (this.currentDoor == this.doorTypes[10]) {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('door_french15'), true);
        window.parent.document.getElementById('door_23').click();
      }

      if (this.currentFascia == 'Natural') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('fascia_natural'));
      }

      if (this.currentFascia == 'Graphite') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('fascia_graphite'));
      }

      if (this.currentFascia == 'Black') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('fascia_black'));
      }

      if (this.currentFloor == 'White') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('floor_white'));
      }

      if (this.currentFloor == 'Grey') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('floor_grey'));
      }

      if (this.currentFloor == 'Oak') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('floor_oak'));
      }

      if (this.currentInterior == 'Melamine') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('wall_melamine'));
      }

      if (this.currentInterior == 'Plaster') {
        this.UpdateActiveMenuItem(window.parent.document.getElementById('wall_plastered'));
      }

      if (this.currentBuilding === 'TGO1') {
        if (this.debugMode) {
          console.log(this.tgoScreen);
        }
        if (this.tgoScreen) {
          window.parent.document.getElementById('sidescreen_on').style.display = 'block';
          window.parent.document.getElementById('sidescreen_off').style.display = 'none';
        } else {
          window.parent.document.getElementById('sidescreen_on').style.display = 'none';
          window.parent.document.getElementById('sidescreen_off').style.display = 'block';
        }
      } else {
        window.parent.document.getElementById('sidescreen_on').style.display = 'none';
        window.parent.document.getElementById('sidescreen_off').style.display = 'none';
      }

      // Remove natural hood if black cladding is selected
      if (this.currentCladding.includes('Composite')) {
        window.parent.document.getElementById('hood_natural').style.display = 'none';
      } else {
        window.parent.document.getElementById('hood_natural').style.display = 'block';
      }

      this.UpdatePricing();
    }

    UpdatePricing() {
      let summaryPricing = '';
      
      if (!this.priceData) {
        window.parent.document.getElementById('price_number').innerHTML = 'N/A';
        
        return;
      }
      
      let building;
      switch (this.currentBuilding) {
        case 'INSP':
          building = 'g1';
          break;
        case 'EDGE':
          building = 'g3';
          break;
        case 'EXPR':
          building = 'g2';
          break;
        case 'PINN':
          building = 'g4';
          break;
        case 'TGO1':
          building = 'g1';
          break;
        case 'TGO2':
          building = 'g2';
          break;
        case 'TGO3':
          building = 'g3';
          break;
        case 'TGO4':
          building = 'g5';
          break;
      }

      let price = 0;

      console.log('Building: ' + building);

      let priceReference = this.priceData.base[building].index;
      let priceOffset = this.priceData.base[building].offset;
      let width = this.buildingWidth / 2 * 1000;
      let depth = this.buildingDepth / 2 * 1000;
      let basePrice = this.priceData.base.reference[priceReference]['d' + depth]['w' + width];

      price += basePrice + priceOffset;

      if (this.debugMode) {
        console.log('Building Base price: ' + price);
      }
      summaryPricing += 'Building Base price: &pound' + price.toLocaleString() + '<br>';

      // Internal finish
      if (this.debugMode) {
        console.log('Building width: ' + this.buildingWidth);
      }
      if (this.debugMode) {
        console.log('Building depth: ' + this.buildingDepth);
      }
      let squareMetres = (this.buildingWidth / 2) * (this.buildingDepth / 2);
      let finishPrice = 0;
      if (this.currentInterior == 'Melamine') {
        finishPrice = this.priceData.internalFinish.standard.offset + (this.priceData.internalFinish.standard.perM2 * squareMetres);
        if (this.debugMode) {
          console.log('Internal finish type: Melamine');
        }
      } else {
        finishPrice = this.priceData.internalFinish.plastered.offset + (this.priceData.internalFinish.plastered.perM2 * squareMetres);
        if (this.debugMode) {
          console.log('Internal finish type: Plastered');
        }
      }

      if (this.debugMode) {
        console.log(squareMetres);
        console.log(this.priceData.internalFinish.plastered.offset);
        console.log(this.priceData.internalFinish.plastered.perM2);
      }

      price += finishPrice;
      if (this.debugMode) {
        console.log('Internal finish price: ' + finishPrice);
      }
      summaryPricing += 'Internal finish price: &pound;' + finishPrice.toLocaleString() + '<br>';

      // Decking
      let deckPricing = 0;
      let deckWidth = (this.buildingWidth / 2) * 1000;
      switch (this.currentDeckCladding) {
        case 'Redwood':
          if (this.currentBuilding == 'INSP') {
            deckPricing = this.priceData.decking.redwood['w' + deckWidth].standard;
          } else {
            deckPricing = 0;
          }
          break;
        case 'Honey':
          if (this.currentBuilding == 'INSP') {
            deckPricing = this.priceData.decking.honey['w' + deckWidth].standard;
          } else {
            deckPricing = this.priceData.decking.honey['w' + deckWidth].extended;
          }
          break;
        case 'Cedar':
          if (this.currentBuilding == 'INSP') {
            deckPricing = this.priceData.decking.cedar['w' + deckWidth].standard;
          } else {
            deckPricing = this.priceData.decking.cedar['w' + deckWidth].extended;
          }
          break;
        case 'Black':
          if (this.currentBuilding == 'INSP') {
            deckPricing = this.priceData.decking.black['w' + deckWidth].standard;
          } else {
            deckPricing = this.priceData.decking.black['w' + deckWidth].extended;
          }
          break;
        case 'Grey':
          if (this.currentBuilding == 'INSP') {
            deckPricing = this.priceData.decking.graphite['w' + deckWidth].standard;
          } else {
            deckPricing = this.priceData.decking.graphite['w' + deckWidth].extended;
          }
          break;
      }

      if (this.buildingRange == 'TGO' && this.currentDeckCladding != 'Cedar' ||
          this.blackHood && this.currentDeckCladding == 'Black' ||
          this.blackHood && this.currentDeckCladding == 'Grey') {
        deckPricing = 0;
      }

      price += deckPricing;
      if (this.debugMode) {
        console.log('Deck price: ' + deckPricing);
      }
      summaryPricing += 'Deck price: &pound;' + deckPricing.toLocaleString() + '<br>';
      
      // Fascia
      let fasciaPrice = 0;
      let fasciaData = this.priceData.fascia;

      switch (this.currentFascia) {
        case 'Natural':
          if (this.currentCladding.indexOf('Redwood') != -1) {
            fasciaPrice = fasciaData.redwood;
          } else if (this.currentCladding.indexOf('Honey') != -1) {
            fasciaPrice = fasciaData.honey;
          } else if (this.currentCladding.includes('Cedar')) {
            fasciaPrice = fasciaData.cedar.cedar;
          }
          break;
        case 'Graphite':
          if (this.currentCladding.indexOf('Redwood') != -1) {
            fasciaPrice = fasciaData['metal-graphite'].redwood;
          } else if (this.currentCladding.indexOf('Honey') != -1) {
            fasciaPrice = fasciaData['metal-graphite'].honey;
          } else if (this.currentCladding.includes('Cedar')) {
            fasciaPrice = fasciaData['metal-graphite'].cedar;
          } else if (this.currentCladding.includes('Composite')) {
            fasciaPrice = fasciaData['metal-black']['composite-black'];
          }
          break;
        case 'Black':
          if (this.currentCladding.indexOf('Redwood') != -1) {
            fasciaPrice = fasciaData['metal-black'].redwood;
          } else if (this.currentCladding.indexOf('Honey') != -1) {
            fasciaPrice = fasciaData['metal-black'].honey;
          } else if (this.currentCladding.includes('Cedar')) {
            fasciaPrice = fasciaData['metal-black'].cedar;
          } else if (this.currentCladding.includes('Composite')) {
            fasciaPrice = fasciaData['metal-black']['composite-black'];
          }
          break;
      }

      fasciaPrice *= 1000;
      fasciaPrice *= this.buildingWidth / 2;
      if (this.buildingRange == 'TGO') {
        fasciaPrice = 0;
      }
      
      price += fasciaPrice;
      if (this.debugMode) {
        console.log('Fascia price: ' + fasciaPrice);
      }
      summaryPricing += 'Fascia price: &pound;' + fasciaPrice.toLocaleString() + '<br>';

      // Cladding
      let claddingPrice = 0;
      switch (this.currentCladding) {
        case 'Redwood':
          claddingPrice = this.priceData.cladding.redwood;
          break;
        case 'Honey':
          claddingPrice = this.priceData.cladding.honey;
          break;
        case 'Cedar':
          claddingPrice = this.priceData.cladding['cedar-natural'];
          break;
        case 'Cedar_Premium':
          claddingPrice = this.priceData.cladding['cedar-premium'];
          break;
        case 'Cedar_Slatted':
          claddingPrice = this.priceData.cladding['cedar-slatted'];
          break;
        case 'Redwood_Slatted':
          claddingPrice = this.priceData.cladding['redwood-slatted'];
          break;
        case 'Honey_Slatted':
          claddingPrice = this.priceData.cladding['honey-slatted'];
          break;
        case 'Composite':
          claddingPrice = this.priceData.cladding['composite-black'];
          break;
        case 'Composite_Oak':
          claddingPrice = this.priceData.cladding['composite-wood'];
          break;
        case 'Composite_Grey':
          claddingPrice = this.priceData.cladding['composite-grey'];
          break;
      }
      
      let claddingMetres = this.buildingWidth;
      claddingMetres -= (this.doorWidth + 1) / 2;
      if (this.debugMode) {
        console.log('Cladding metres after door');
        console.log(claddingMetres);
      }
      
      let baseCladdingPrice = claddingPrice;
      claddingMetres += this.buildingDepth;
      if (this.debugMode) {
        console.log('Cladding metres after width+depth');
        console.log(claddingMetres);
      }

      if (this.buildingRange == 'TGO' && this.tgoFullHeightWindow) {
        claddingMetres -= 1;
      }
      claddingPrice *= claddingMetres;
      claddingPrice = Math.floor(claddingPrice / 5) * 5;
      if (this.debugMode) {
        console.log('Cladding metres: ' + claddingMetres);
        console.log('Cladding price for all metres: ' + claddingPrice);
      }

      if (this.buildingRange === 'GR') {
        if (this.buildingWidth / 2 % 1 != 0 || this.buildingDepth / 2 % 1 != 0) {
          if (baseCladdingPrice.toString().substr(-1, 1) === '5') {
            claddingPrice -= 5;
          }
        }
      } 

      // Add excess cladding from door
      let doorExcess = parseInt(this.currentDoor.name.substr(-1, 1));
      doorExcess /= 10;
      let doorExcessPrice = parseFloat((0.5 - doorExcess).toFixed(2));
      if (this.debugMode) {
        console.log(doorExcess);
        console.log(doorExcessPrice);
      }
      doorExcessPrice *= baseCladdingPrice;
      doorExcessPrice = Math.floor(doorExcessPrice / 5) * 5;
      claddingPrice += doorExcessPrice;
      // claddingPrice = Math.floor(claddingPrice / 5) * 5;

      price += claddingPrice;
      if (this.debugMode) {
        console.log('Cladding price: ' + claddingPrice);
      }
      summaryPricing += 'Cladding price: &pound;' + claddingPrice.toLocaleString() + '<br>';

      let doorPrice = 0;
      if (this.currentDoor.name !== 'SM_French_1_5') {
        doorPrice = this.priceData.panel[this.currentDoor.name].price;
      }
      price += doorPrice;
      if (this.debugMode) {
        console.log('Door price: ' + doorPrice);
      }
      summaryPricing += 'Door price: &pound;' + doorPrice.toLocaleString() + '<br>';

      if (this.tgoScreen) {
        price += 315;
        summaryPricing += 'Side Screen price: &pound;315<br>';
      }

      let priceString = price.toLocaleString();
      window.parent.document.getElementById('sq_m').innerHTML = `${squareMetres} m<sup>2</sup>`;
      window.parent.document.getElementById('price_number').innerHTML = '&pound;' + priceString;
      window.parent.document.getElementById('summary_text').innerHTML = summaryPricing;
    }

    ToggleGarden(active) {
      this.garden = !this.garden;
      
      this.UpdateGarden();
    }

    UpdateGarden() {
      if (this.garden) {
        this.ShowObject(this.GetObject('Dome_Lythwood_Field'));
        this.HideObject(this.GetObject('bgSphere'));
      } else {
        this.HideObject(this.GetObject('Dome_Lythwood_Field'));
        this.ShowObject(this.GetObject('bgSphere'));
      }
    }

    HideAllObjects() {
      app.scene.traverse((obj) => {
        if (obj.type !== 'AmbientLight' && obj.type !== 'DirectionalLight' && obj.name !== 'aiSkyDomeLight1' && obj.name !== 'Scene' && obj.name !== 'bgSphere' && obj.name !== 'SM_PanelLight' && obj.name !== 'Shadowmatte') {
          obj.visible = false;
        }
      });
    }

    GetObject(objName) {
      let foundObj;
      app.scene.traverse((obj) => {
        if (obj.name === objName) {
          foundObj = obj;
        }
      });

      return foundObj;
    }

    ShowObject(obj) {
      obj.visible = true;
      obj.traverse((child) => {
        child.visible = true;
      });
    }

    HideObject(obj) {
      if (!obj) {
        console.log('No object found!');

        return;
      }
      obj.visible = false;
      obj.traverse((child) => {
        child.visible = false;
      });
    }

    CloneObject(objName) {    
      let newObj;
      app.scene.traverse((obj) => {
        if (obj.name == objName) {
          newObj = obj.clone();
          newObj.name = newObj.name + '0';

          app.scene.add(newObj);
          newObj.visible = false;
        }
      });

      return newObj;
    }

    MakeParent(objName, targetObjName) {
      if (!objName)
        return;
      var obj = this.GetObjectByName(objName);
      if (!obj)
        return;
      if (targetObjName) {
        var targetObj = this.GetObjectByName(targetObjName);
        if (!targetObj)
          return;
      } else {
        obj.traverseAncestors(function (ancObj) {
          if (ancObj.type == "Scene")
            targetObj = ancObj;
        });
      }
      
      var matOffset = new v3d.Matrix4();
      matOffset.getInverse(targetObj.matrixWorld);
      matOffset.multiply(obj.matrixWorld);
      matOffset.decompose(obj.position, obj.quaternion, obj.scale);
      targetObj.add(obj);

      obj.updateMatrixWorld(true);
    }

    RetrieveObjectNames(objNames) {
      var acc = [];
      this.RetrieveObjectNamesAcc(objNames, acc);
      return acc;
    }
    
    RetrieveObjectNamesAcc(currObjNames, acc) {
        if (typeof currObjNames == "string") {
            acc.push(currObjNames);
        } else if (Array.isArray(currObjNames) && currObjNames[0] == "GROUP") {
            var newObj = this.GetObjectNamesByGroupName(currObjNames[1]);
            for (var i = 0; i < newObj.length; i++)
                acc.push(newObj[i]);
        } else if (Array.isArray(currObjNames) && currObjNames[0] == "ALL_OBJECTS") {
            var newObj = this.GetAllObjectNames();
            for (var i = 0; i < newObj.length; i++)
                acc.push(newObj[i]);
        } else if (Array.isArray(currObjNames)) {
            for (var i = 0; i < currObjNames.length; i++)
                this.RetrieveObjectNamesAcc(currObjNames[i], acc);
        }
    }

    GetAllObjectNames() {
      var objNameList = [];
      app.scene.traverse(function(obj) {
        objNameList.push(obj.name)
      });
      return objNameList;
    }

    NotIgnoredObj(obj) {
      return (obj.type !== "AmbientLight" && obj.name !== "" && !(obj.isMesh && obj.isMaterialGeneratedMesh));
    }

    GetObjectByName(objName) {
      var objFound;
      var runTime = _pGlob !== undefined;
      objFound = runTime ? _pGlob.objCache[objName] : null;

      if (objFound && objFound.name === objName)
        return objFound;

      app.scene.traverse(function (obj) {
        if (!objFound && (obj.name == objName)) {
          objFound = obj;
          if (runTime) {
            _pGlob.objCache[objName] = objFound;
          }
        }
      });
      return objFound;
    }

    GetObjectNamesByGroupName(targetGroupName) {
      var objNameList = [];
      app.scene.traverse(function(obj){
        if (this.NotIgnoredObj(obj)) {
          var groupNames = obj.groupNames;
          if (!groupNames)
            return;
          for (var i = 0; i < groupNames.length; i++) {
            var groupName = groupNames[i];
            if (groupName == targetGroupName) {
                objNameList.push(obj.name);
            }
          }
        }
      });
      return objNameList;
    }

    SetMaterialColor(matName, colName, r, g, b, cssCode) {
      var colors = this.MatGetColors(matName);
    
      if (colors.indexOf(colName) < 0)
          return;
    
      if (cssCode) {
          var color = new v3d.Color(cssCode);
          color.convertSRGBToLinear();
          r = color.r;
          g = color.g;
          b = color.b;
      }
    
      var mats = v3d.SceneUtils.getMaterialsByName(app, matName);
    
      for (var i = 0; i < mats.length; i++) {
          var mat = mats[i];
    
          if (mat.isMeshNodeMaterial) {
              var rgbIdx = mat.nodeRGBMap[colName];
              mat.nodeRGB[rgbIdx].x = r;
              mat.nodeRGB[rgbIdx].y = g;
              mat.nodeRGB[rgbIdx].z = b;
          } else {
              mat[colName].r = r;
              mat[colName].g = g;
              mat[colName].b = b;
          }
          mat.needsUpdate = true;
    
          if (mat === app.worldMaterial)
              app.updateEnvironment(mat);
      }
    }

    SetObjTransform(objSelector, mode, vector, offset) {
      var x = vector[0];
      var y = vector[1];
      var z = vector[2];

      var objNames = this.RetrieveObjectNames(objSelector);

      function setObjProp(obj, prop, val) {
        if (!offset) {
          obj[mode][prop] = val;
        } else {
          if (mode != "scale")
            obj[mode][prop] += val;
          else
            obj[mode][prop] *= val;
        }
      }

      var inputsUsed = _pGlob.vec3Tmp.set(Number(x !== ''), Number(y !== ''),
        Number(z !== ''));
      var coords = _pGlob.vec3Tmp2.set(x || 0, y || 0, z || 0);

      if (mode === 'rotation') {
        // rotations are specified in degrees
        coords.multiplyScalar(v3d.MathUtils.DEG2RAD);
      }

      var coordSystem = this.GetCoordSystem();

      this.CoordsTransform(inputsUsed, coordSystem, 'Y_UP_RIGHT', true);
      this.CoordsTransform(coords, coordSystem, 'Y_UP_RIGHT', mode === 'scale');

      for (var i = 0; i < objNames.length; i++) {

        var objName = objNames[i];
        if (!objName) continue;

        var obj = this.GetObjectByName(objName);
        if (!obj) continue;

        if (mode === 'rotation' && coordSystem == 'Z_UP_RIGHT') {
          // Blender/Max coordinates

          // need all the rotations for order conversions, especially if some
          // inputs are not specified
          var euler = eulerV3DToBlenderShortest(obj.rotation, _pGlob.eulerTmp);
          coordsTransform(euler, coordSystem, 'Y_UP_RIGHT');

          if (inputsUsed.x) euler.x = offset ? euler.x + coords.x : coords.x;
          if (inputsUsed.y) euler.y = offset ? euler.y + coords.y : coords.y;
          if (inputsUsed.z) euler.z = offset ? euler.z + coords.z : coords.z;

          /**
           * convert from Blender/Max default XYZ extrinsic order to v3d XYZ
           * intrinsic with reversion (XYZ -> ZYX) and axes swizzling (ZYX -> YZX)
           */
          euler.order = "YZX";
          euler.reorder(obj.rotation.order);
          obj.rotation.copy(euler);

        } else if (mode === 'rotation' && coordSystem == 'Y_UP_RIGHT') {
          // Maya coordinates

          // Use separate rotation interface to fix ambiguous rotations for Maya,
          // might as well do the same for Blender/Max.

          var rotUI = RotationInterface.initObject(obj);
          var euler = rotUI.getUserRotation(_pGlob.eulerTmp);
          // TODO(ivan): this probably needs some reasonable wrapping
          if (inputsUsed.x) euler.x = offset ? euler.x + coords.x : coords.x;
          if (inputsUsed.y) euler.y = offset ? euler.y + coords.y : coords.y;
          if (inputsUsed.z) euler.z = offset ? euler.z + coords.z : coords.z;

          rotUI.setUserRotation(euler);
          rotUI.getActualRotation(obj.rotation);
        } else {

          if (inputsUsed.x) setObjProp(obj, "x", coords.x);
          if (inputsUsed.y) setObjProp(obj, "y", coords.y);
          if (inputsUsed.z) setObjProp(obj, "z", coords.z);

        }

        obj.updateMatrixWorld(true);
      }

    }

    EulerV3DToBlenderShortest() {
      var eulerTmp = new v3d.Euler();
      var eulerTmp2 = new v3d.Euler();
      var vec3Tmp = new v3d.Vector3();

      return function (euler, dest) {

        var eulerBlender = eulerTmp.copy(euler).reorder('YZX');
        var eulerBlenderAlt = eulerTmp2.copy(eulerBlender).makeAlternative();

        var len = eulerBlender.toVector3(vec3Tmp).lengthSq();
        var lenAlt = eulerBlenderAlt.toVector3(vec3Tmp).lengthSq();

        dest.copy(len < lenAlt ? eulerBlender : eulerBlenderAlt);
        return coordsTransform(dest, 'Y_UP_RIGHT', 'Z_UP_RIGHT');
      }
    }

    GetObjTransform(objName, mode, coord) {
      if (!objName)
        return;
      var obj = getObjectByName(objName);
      if (!obj)
        return;

      var coordSystem = this.GetCoordSystem();

      var transformVal;

      if (mode === 'rotation' && coordSystem == 'Z_UP_RIGHT') {
        transformVal = this.EulerV3DToBlenderShortest(obj.rotation,
          _pGlob.eulerTmp);
      } else if (mode === 'rotation' && coordSystem == 'Y_UP_RIGHT') {
        // Maya coordinates
        // Use separate rotation interface to fix ambiguous rotations for Maya,
        // might as well do the same for Blender/Max.

        var rotUI = RotationInterface.initObject(obj);
        transformVal = rotUI.getUserRotation(_pGlob.eulerTmp);
      } else {
        transformVal = this.CoordsTransform(obj[mode].clone(), 'Y_UP_RIGHT',
          this.GetCoordSystem(), mode === 'scale');
      }

      if (mode === 'rotation') {
        transformVal.x = v3d.MathUtils.radToDeg(transformVal.x);
        transformVal.y = v3d.MathUtils.radToDeg(transformVal.y);
        transformVal.z = v3d.MathUtils.radToDeg(transformVal.z);
      }

      if (coord == 'xyz') {
        // remove order component for Euler vectors
        return transformVal.toArray().slice(0, 3);
      } else {
        return transformVal[coord];
      }
    }

    SetObjDirection(objSelector, vector, isPoint, lockUp) {
      var objNames = retrieveObjectNames(objSelector);
      var x = vector[0] || 0;
      var y = vector[1] || 0;
      var z = vector[2] || 0;

      var coords = this.CoordsTransform(_pGlob.vec3Tmp.set(x, y, z), this.GetCoordSystem(), 'Y_UP_RIGHT');

      for (var i = 0; i < objNames.length; i++) {
        var objName = objNames[i];
        if (!objName) continue;

        var obj = getObjectByName(objName);
        if (!obj) continue;

        if (!isPoint) {
          coords.normalize().add(obj.position);
        }

        if (lockUp) {
          // NOTE: partially copy-pasted from LockedTrackConstraint

          var targetWorldPos = new v3d.Vector3(coords.x, coords.y, coords.z);

          var lockDir = new v3d.Vector3(0, 1, 0);

          if (obj.isCamera || obj.isLight)
            var trackDir = new v3d.Vector3(0, 0, -1);
          else
            var trackDir = new v3d.Vector3(0, 0, 1);

          var projDir = new v3d.Vector3();
          var plane = _pGlob.planeTmp;

          var objWorldPos = new v3d.Vector3();
          objWorldPos.setFromMatrixPosition(obj.matrixWorld);

          plane.setFromNormalAndCoplanarPoint(lockDir, objWorldPos);
          plane.projectPoint(targetWorldPos, projDir).sub(objWorldPos);

          var sign = _pGlob.vec3Tmp2.crossVectors(trackDir, projDir).dot(lockDir) > 0 ? 1 : -1;

          obj.setRotationFromAxisAngle(plane.normal, sign * trackDir.angleTo(projDir));

          if (obj.parent) {
            obj.parent.matrixWorld.decompose(_pGlob.vec3Tmp2, _pGlob.quatTmp, _pGlob.vec3Tmp2);
            obj.quaternion.premultiply(_pGlob.quatTmp.invert());
          }

        } else {

          obj.lookAt(coords.x, coords.y, coords.z);

        }

        obj.updateMatrixWorld(true);
      }
    }

    MatGetColors(matName) {
      var mat = v3d.SceneUtils.getMaterialByName(app, matName);
      if (!mat)
          return [];
    
      if (mat.isMeshNodeMaterial)
          return Object.keys(mat.nodeRGBMap);
      else if (mat.isMeshStandardMaterial)
          return ['color', 'emissive'];
      else
          return [];
    }

    ReplaceTexture(matName, texName, texUrlOrElem, doCb) {
      var textures = this.MatGetEditableTextures(matName, true).filter(function(elem) {
        return elem.name == texName;
      });
  
      if (!textures.length)
        return;
  
      if (texUrlOrElem instanceof Promise) {
  
        texUrlOrElem.then(function(response) {
            processImageUrl(response);
        }, function(error) {});
  
      } else if (typeof texUrlOrElem == 'string') {
  
        processImageUrl(texUrlOrElem);
  
      } else if (texUrlOrElem instanceof HTMLVideoElement) {
  
        // processVideo(texUrlOrElem);
  
      } else if (texUrlOrElem instanceof HTMLCanvasElement) {
  
        // processCanvas(texUrlOrElem);
  
      } else {
  
        return;
  
      }

      function processImageUrl(url) {

        var isHDR = (url.search(/\.hdr$/) > 0);
      
        if (!isHDR) {
          var loader = new v3d.ImageLoader();
          loader.setCrossOrigin('Anonymous');
        } else {
          var loader = new v3d.FileLoader();
          loader.setResponseType('arraybuffer');
        }
      
        loader.load(url, function (image) {
          var isJPEG = url.search(/\.(jpg|jpeg)$/) > 0 || url.search(/^data\:image\/jpeg/) === 0;
      
          textures.forEach(function (elem) {
      
            if (!isHDR) {
              elem.image = image;
            } else {
              var rgbeLoader = new v3d.RGBELoader();
              var texData = rgbeLoader.parse(image);
      
              elem.type = v3d.UnsignedByteType;
              elem.encoding = v3d.RGBEEncoding;
      
              elem.image = {
                data: texData.data,
                width: texData.width,
                height: texData.height
              }
      
              elem.magFilter = v3d.LinearFilter;
              elem.minFilter = v3d.LinearFilter;
              elem.generateMipmaps = false;
              elem.isDataTexture = true;
      
            }
      
            elem.format = isJPEG ? v3d.RGBFormat : v3d.RGBAFormat;
            elem.needsUpdate = true;
      
            var wMat = app.worldMaterial;
            if (wMat)
              for (var texName in wMat.nodeTextures)
                if (wMat.nodeTextures[texName] == elem)
                  app.updateEnvironment(wMat);
      
          });
      
          doCb();
        });
      }
    }

    MatGetEditableTextures(matName, collectSameNameMats) {
      var mats = [];
      if (collectSameNameMats) {
        mats = v3d.SceneUtils.getMaterialsByName(app, matName);
      } else {
        var firstMat = v3d.SceneUtils.getMaterialByName(app, matName);
        if (firstMat !== null) {
          mats = [firstMat];
        }
      }
    
      var textures = mats.reduce(function (texArray, mat) {
        var matTextures = [];
        switch (mat.type) {
          case 'MeshNodeMaterial':
            matTextures = Object.values(mat.nodeTextures);
            break;
    
          case 'MeshStandardMaterial':
            matTextures = [
              mat.map, mat.lightMap, mat.aoMap, mat.emissiveMap,
              mat.bumpMap, mat.normalMap, mat.displacementMap,
              mat.roughnessMap, mat.metalnessMap, mat.alphaMap, mat.envMap
            ]
            break;
    
          case 'MeshPhongMaterial':
            matTextures = [
              mat.map, mat.lightMap, mat.aoMap, mat.emissiveMap,
              mat.bumpMap, mat.normalMap, mat.displacementMap,
              mat.specularMap, mat.alphaMap, mat.envMap
            ];
            break;
          default:
            console.error('matGetEditableTextures: Unknown material type ' + mat.type);
            break;
        }
    
        Array.prototype.push.apply(texArray, matTextures);
        return texArray;
      }, []);
    
      return textures.filter(function (elem) {
        return elem && (elem.constructor == v3d.Texture
          || elem.constructor == v3d.DataTexture
          || elem.constructor == v3d.VideoTexture);
      });
    }

    ExportBuilding() {
      let buildingData = {
        buildingRange: this.buildingRange,
        buildingType: this.currentBuilding,
        width: this.buildingWidth,
        depth: this.buildingDepth,
        cladding: this.currentCladding,
        decking: this.currentDeckCladding,
        fascia: this.currentFascia,
        door: this.currentDoor.name,
        doorWidth: this.doorWidth,
        doorPosition: this.doorPosition,
        floor: this.currentFloor,
        walls: this.currentInterior,
        tgoFullHeightWindow: this.tgoFullHeightWindow,
        guidePrice: this.price,
        blackHood: this.blackHood
      }

      let buildings = JSON.parse(localStorage.getItem('buildings'));
      
      if (!buildings) {
        localStorage.setItem('buildings', JSON.stringify([buildingData]));
      } else {
        buildings.push(buildingData);

        localStorage.setItem('buildings', JSON.stringify(buildings));
      }

      if (this.debugMode) {
        console.log(JSON.stringify(buildingData));
      }

      this.UpdateSavedBuildingsList();
    }

    ResetCamera() {
      this.TweenCamera('Cameraposition', 'Cameralookat', 1, function() {}, 1);
    }

    EmailBuilding() {      
      let building = 1;

      switch (this.currentBuilding) {
        case 'TGO1':
          building = 1;
          break;
        case 'TGO2':
          building = 2;
          break;
        case 'TGO3':
          building = 3;
          break;
        case 'PINN':
          building = 4;
          break;
        case 'TGO4':
          building = 5;
          break;
      }
      
      let params = '?r=g' +
                   '&b=' + building +
                   '&wi=' + this.buildingWidth +
                   '&d=' + this.buildingDepth +
                   '&c=' + this.currentCladding +
                   '&dc=' + this.currentDeckCladding +
                   '&f=' + this.currentFascia +
                   '&do=' + this.currentDoor.name +
                   '&dw=' + this.doorWidth +
                   '&dp=' + this.doorPosition +
                   '&flr=' + this.currentFloor +
                   '&i=' + this.currentInterior +
                   '&fhw=' + this.tgoFullHeightWindow +
                   '&p=' + this.price +
                   '&bhd=' + this.blackHood;

      var doorPosition = this.doorPosition;
      if (this.currentDoor.name === 'SM_French_1_5') {
        doorPosition = 0;
      }

      let flooring = this.currentFloor;
      if (flooring = 'White')
      {
        flooring = 'DarkOak';
      }
      
      let configuratorParams = '?r=g' +
                   '&b=' + building +
                   '&w=' + this.buildingWidth +
                   '&d=' + this.buildingDepth +
                   '&c=' + this.currentCladding +
                   '&dc=' + this.currentDeckCladding +
                   '&f=' + this.currentFascia +
                   '&do=' + this.currentDoor.name +
                   '&dw=' + this.doorWidth +
                   '&dp=' + doorPosition +
                   '&flr=' + flooring +
                   '&i=' + this.currentInterior +
                   '&fhw=' + parseInt(this.tgoFullHeightWindow) +
                   '&p=' + this.price +
                   '&bhd=' + this.blackHood;

      let buildingData = {
                    buildingRange: 'g',
                    buildingType: building,
                    width: this.buildingWidth,
                    depth: this.buildingDepth,
                    cladding: this.currentCladding,
                    decking: this.currentDeckCladding,
                    fascia: this.currentFascia,
                    door: this.currentDoor.name,
                    doorWidth: this.doorWidth,
                    doorPosition: this.doorPosition,
                    floor: flooring,
                    walls: this.currentInterior,
                    tgoFullHeightWindow: this.tgoFullHeightWindow,
                    guidePrice: this.price,
                    blackHood: this.blackHood
                  }
                  
      let data = {
        source: 'visualiser',
        url: 'https://' + window.parent.parent.location.hostname + '/design/' + params,
        configurator: 'https://my.catro.co.uk/configurator/configurator-api/import.php' + configuratorParams,
        'buildingData': JSON.stringify(buildingData)
      };

      window.parent.parent.postMessage(JSON.stringify(data), '*');
      
      this.UpdateBuilding();
    }

    SaveBuilding() {
      let params = '?r=' + this.buildingRange +
                    '&b=' + this.currentBuilding +
                    '&wi=' + this.buildingWidth +
                    '&d=' + this.buildingDepth +
                    '&c=' + this.currentCladding +
                    '&dc=' + this.currentDeckCladding +
                    '&f=' + this.currentFascia +
                    '&do=' + this.currentDoor.name +
                    '&dw=' + this.doorWidth +
                    '&dp=' + this.doorPosition +
                    '&flr=' + this.currentFloor +
                    '&i=' + this.currentInterior +
                    '&fhw=' + this.tgoFullHeightWindow +
                    '&p=' + this.price +
                    '&bhd=' + this.blackHood;

      let configuratorParams = '?r=' + this.buildingRange +
                    '&b=' + this.currentBuilding +
                    '&w=' + this.buildingWidth +
                    '&d=' + this.buildingDepth +
                    '&c=' + this.currentCladding +
                    '&dc=' + this.currentDeckCladding +
                    '&f=' + this.currentFascia +
                    '&do=' + this.currentDoor.name +
                    '&dw=' + this.doorWidth +
                    '&dp=' + this.doorPosition +
                    '&flr=' + this.currentFloor +
                    '&i=' + this.currentInterior +
                    '&fhw=' + parseInt(this.tgoFullHeightWindow) +
                    '&p=' + this.price +
                    '&bhd=' + this.blackHood;

      let buildingData = {
                    buildingRange: this.buildingRange,
                    buildingType: this.currentBuilding,
                    width: this.buildingWidth,
                    depth: this.buildingDepth,
                    cladding: this.currentCladding,
                    decking: this.currentDeckCladding,
                    fascia: this.currentFascia,
                    door: this.currentDoor.name,
                    doorWidth: this.doorWidth,
                    doorPosition: this.doorPosition,
                    floor: this.currentFloor,
                    walls: this.currentInterior,
                    tgoFullHeightWindow: this.tgoFullHeightWindow,
                    guidePrice: this.price,
                    blackHood: this.blackHood
                  }

      var url = 'https://wordpress-281356-2068944.cloudwaysapps.com/visualiser-ar-development' + params;

      return url;
    }

    RandomBuilding() {
      this.currentBuilding = this.buildingTypes[Math.floor(Math.random() * this.buildingTypes.length)];
      this.currentCladding = this.claddingTypes[Math.floor(Math.random() * this.claddingTypes.length)];
      this.buildingWidth = 4 + Math.floor(Math.random() * 16);
      this.buildingDepth = 4 + Math.floor(Math.random() * 6);
      let door = Math.floor(Math.random() * this.doorTypes.length);
      this.currentDoor = this.doorTypes[door];
      this.doorWidth = this.doorWidths[door];
      this.doorPosition = Math.floor(Math.random() * this.buildingWidth) - this.doorWidth;
      this.tgoFullHeightWindow = false;
      
      if (this.currentBuilding.indexOf('TGO') >= 0) {
        this.buildingRange = 'TGO';
      } else {
        this.buildingRange = 'GR';
      }

      this.UpdateMaterials();
      this.UpdateBuilding();
    }

    TweenCamera(posOrObj, targetOrObj, duration, doSlot, movementType) {
      if (Array.isArray(posOrObj)) {
        var worldPos = _pGlob.vec3Tmp.fromArray(posOrObj);
        worldPos = this.CoordsTransform(worldPos, this.GetCoordSystem(), 'Y_UP_RIGHT');
      } else if (posOrObj) {
        var posObj = this.GetObjectByName(posOrObj);
        if (!posObj) return;
        var worldPos = posObj.getWorldPosition(_pGlob.vec3Tmp);
      } else {
        var worldPos = app.camera.getWorldPosition(_pGlob.vec3Tmp);
      }

      if (Array.isArray(targetOrObj)) {
        var worldTarget = _pGlob.vec3Tmp2.fromArray(targetOrObj);
        worldTarget = this.CoordsTransform(worldTarget, this.GetCoordSystem(), 'Y_UP_RIGHT');
      } else {
        var targObj = this.GetObjectByName(targetOrObj);
        if (!targObj) return;
        var worldTarget = targObj.getWorldPosition(_pGlob.vec3Tmp2);
      }

      duration = Math.max(0, duration);

      if (app.controls && app.controls.tween) {
        if (!app.controls.inTween) {
          app.controls.tween(worldPos, worldTarget, duration, doSlot,
            movementType);
        }
      } else {
        if (app.camera.parent) {
          app.camera.parent.worldToLocal(worldPos);
        }
        app.camera.position.copy(worldPos);
        app.camera.lookAt(worldTarget);
        doSlot();
      }
    }

    CheckARMode(availableCb, unAvailableCb) {
      if (v3d.Detector.checkWebXR)
        v3d.Detector.checkWebXR('immersive-ar', availableCb, unAvailableCb);
      else
        app.checkWebXR('immersive-ar', availableCb, unAvailableCb);
    }

    EnterAR() {
      let AR_available = true;
      let indicator;
      if (AR_available) {
        this.SaveState(['Camera', 'SM_Deck_1a_Left1', 'indicator_group', 'bgSphere', 'Dome_Lythwood_Field'], '');

        // this.GetObject('SM_Deck_1a_Left1').position.x = 0;
        // this.GetObject('SM_Deck_1a_Left1').position.y = -1;
        // this.GetObject('SM_Deck_1a_Left1').position.z = -5;

        var self = this;
        var exitURL = self.SaveBuilding();
        this.EnterARMode(function() {
          self.HideObject(self.GetObject('bgSphere'));
          self.HideObject(self.GetObject('Dome_Lythwood_Field'));
          // self.HideObject(self.GetObject('SM_Deck_1a_Left1'));
          self.GetObject('SM_Deck_1a_Left1').position.x = 99999;
          self.GetObject('SM_Deck_1a_Left1').position.y = 99999;
          self.GetObject('SM_Deck_1a_Left1').position.z = 99999;
          // self.GetObject('SM_Deck_1a_Left1').scale.x = 0.01;
          // self.GetObject('SM_Deck_1a_Left1').scale.y = 0.01;
          // self.GetObject('SM_Deck_1a_Left1').scale.z = 0.01;
          // self.GetObject('indicator').scale.x = 1;
          // self.GetObject('indicator').scale.y = 1;
          // self.GetObject('indicator').scale.z = 1;
          self.GetObject('SM_PanelLight').parent = null;
          
          self.ARHitTest(function() {
            self.ShowObject(self.GetObject('indicator_group'));

            self.GetObject('indicator_group').position.x = self.ARHitPoint('x');
            self.GetObject('indicator_group').position.y = self.ARHitPoint('y');
            self.GetObject('indicator_group').position.z = self.ARHitPoint('z');

            self.SetObjDirection('indicator_group', [self.GetObjTransform('Camera', 'position', 'x'), self.GetObjTransform('Camera', 'position', 'y'), self.GetObjTransform('Camera', 'position', 'z')], true, true);
            self.arIndicatorRotation = self.GetObject('indicator_group').rotation;

            // this.GetObject('SM_Deck_1a_Left1').position.x = _pGlob.arHitPoint('x');
            // this.GetObject('SM_Deck_1a_Left1').position.y = _pGlob.arHitPoint('y');
            // this.GetObject('SM_Deck_1a_Left1').position.z = _pGlob.arHitPoint('z');

          }, function() {
            self.HideObject(self.GetObject('indicator_group'));
          }, 0.7);

          // Hide Enter AR button
        }, function() {
          // self.UndoState();
          // self.HideAllObjects();
          window.parent.parent.location.href = exitURL;
          // Reset by refreshing the page
          // openWebPage(getUrlData('URL', false), 'SAME');
          // this.GetObject('SM_Deck_1a_Left1').scale.x = 1;
          // this.GetObject('SM_Deck_1a_Left1').scale.y = 1;
          // this.GetObject('SM_Deck_1a_Left1').scale.z = 1;
          // this.GetObject('SM_Deck_1a_Left1').position.x = 325 + (this.buildingWidth - (this.buildingWidth / 2) * 50);
          // this.GetObject('SM_Deck_1a_Left1').position.y = -3;
          
          // this.ResetCamera();
          // Object.assign(app.camera, this.camera);
        }, function() {
          // show_warning('warning_could_not_enter_AR');
        });
      } else {
        // show_warning('warning_AR_unavailable');
      }
    }

    EnterARMode(enterCb, exitCb, unAvailableCb) {
      app.initWebXR('immersive-ar', 'local', function() {
          var controllers = app.xrControllers;
  
          for (var i = 0; i < controllers.length; i++) {
              var controller = controllers[i];
  
              controller.addEventListener('select', _pGlob.xrOnSelect);
  
              _pGlob.xrSessionCallbacks.forEach(function(pair) {
                  controller.addEventListener(pair[0], pair[1]);
              });
          }
          _pGlob.xrSessionAcquired = true;
  
          enterCb();
  
      }, unAvailableCb, function() {
          var controllers = app.xrControllers;
  
          for (var i = 0; i < controllers.length; i++) {
              var controller = controllers[i];
  
              controller.removeEventListener('select', _pGlob.xrOnSelect);
  
              _pGlob.xrSessionCallbacks.forEach(function(pair) {
                  controller.removeEventListener(pair[0], pair[1]);
              });
          }
  
          _pGlob.xrSessionAcquired = false;
  
          exitCb();
  
      });
    }

    EnterARModeUSDZ(objSelector) {
      if (objSelector === '' || objSelector === '<none>') {
        var obj = app.scene;
        console.log('obj is app.scene');
      } else {
        var obj = this.GetObjectByName(objSelector);
        console.log('obj is found by selector');
      }

      if (!obj)
        return;

      if (Blob.prototype.arrayBuffer == undefined)
        console.log('blob arraybuffer undefined');
        Blob.prototype.arrayBuffer = function () {
          return new Response(this).arrayBuffer()
        }

      var usdzExporter = new v3d.USDZExporter();

      return new Promise(function (resolve, reject) {
        
        usdzExporter.parse(obj).then(function (value) {
          console.log(value);

          var dataUrl = URL.createObjectURL(new Blob([value], { type: 'application/octet-stream' }));
          resolve(dataUrl + '#allowsContentScaling=0');

        }, function (reason) {

          console.error('exportToUSDZ: export failed: ' + reason);
          reject(reason);

        });
      });
    }

    ARHitTest(cbHit, cbMiss, smooth) {
      app.renderer.xr.arHitTest(0, 0, function (point) {
        smooth = v3d.Math.clamp(smooth, 0, 1);
  
        var x = point.x;
        var y = point.y;
        var z = point.z;
  
        _pGlob.arHitPoint.x = _pGlob.arHitPoint.x * smooth + (1 - smooth) * x;
        _pGlob.arHitPoint.y = _pGlob.arHitPoint.y * smooth + (1 - smooth) * y;
        _pGlob.arHitPoint.z = _pGlob.arHitPoint.z * smooth + (1 - smooth) * z;
  
        cbHit();
      }, cbMiss);
    }
  
    ARHitPoint(coord) {
      let hitPoint = this.CoordsTransform(_pGlob.vec3Tmp.copy(_pGlob.arHitPoint), 'Y_UP_RIGHT', this.GetCoordSystem());
  
      if (coord == 'xyz') {
        return hitPoint.toArray();
      } else {
        return hitPoint[coord];
      }
    }

    RegisterOnClick(objSelector, xRay, doubleClick, mouseButtons, cbDo, cbIfMissedDo) {
      // for AR/VR
      _pGlob.objClickInfo = _pGlob.objClickInfo || [];

      _pGlob.objClickInfo.push({
        objSelector: objSelector,
        callbacks: [cbDo, cbIfMissedDo]
      });

      var self = this;
      this.InitObjectPicking(function (intersects, event) {
        var isPicked = false;

        var maxIntersects = xRay ? intersects.length : Math.min(1, intersects.length);

        for (var i = 0; i < maxIntersects; i++) {
          var obj = intersects[i].object;
          var objName = self.GetPickedObjectName(obj);
          var objNames = self.RetrieveObjectNames(objSelector);

          if (self.ObjectsIncludeObj(objNames, objName)) {
            // save the object for the pickedObject block
            _pGlob.pickedObject = objName;
            isPicked = true;
            cbDo(event);
          }
        }

        if (!isPicked) {
          _pGlob.pickedObject = '';
          cbIfMissedDo(event);
        }

      }, doubleClick ? 'dblclick' : 'mousedown', false, mouseButtons);
    }

    ApplyObjLocalTransform(objSelector, mode, vector) {
      var objNames = this.RetrieveObjectNames(objSelector);
      var x = vector[0] || 0;
      var y = vector[1] || 0;
      var z = vector[2] || 0;

      var defValue = mode == "scale" ? 1 : 0;
      if (typeof x != "number") x = defValue;
      if (typeof y != "number") y = defValue;
      if (typeof z != "number") z = defValue;

      var coords = this.CoordsTransform(_pGlob.vec3Tmp.set(x, y, z), this.GetCoordSystem(), 'Y_UP_RIGHT', mode == 'scale');

      for (var i = 0; i < objNames.length; i++) {
        var objName = objNames[i];
        if (!objName) continue;

        var obj = this.GetObjectByName(objName);
        if (!obj) continue;

        // don't transform values for cameras, their local space happens
        // to be the same as for Blender/Max cameras, bcz their different
        // rest orientation balances difference in coordinate systems
        var useTransformed = !obj.isCamera;
        var xVal = useTransformed ? coords.x : x;
        var yVal = useTransformed ? coords.y : y;
        var zVal = useTransformed ? coords.z : z;

        switch (mode) {
          case "position":
            if (_pGlob.xrSessionAcquired && obj.isCamera) {
              v3d.WebXRUtils.translateVRCamera(obj, _pGlob.AXIS_X, xVal);
              v3d.WebXRUtils.translateVRCamera(obj, _pGlob.AXIS_Y, yVal);
              v3d.WebXRUtils.translateVRCamera(obj, _pGlob.AXIS_Z, zVal);
            } else {
              obj.translateX(xVal);
              obj.translateY(yVal);
              obj.translateZ(zVal);
            }
            break;
          case "rotation":
            if (_pGlob.xrSessionAcquired && obj.isCamera) {
              v3d.WebXRUtils.rotateVRCamera(obj, _pGlob.AXIS_X, v3d.MathUtils.degToRad(xVal));
              v3d.WebXRUtils.rotateVRCamera(obj, _pGlob.AXIS_Y, v3d.MathUtils.degToRad(yVal));
              v3d.WebXRUtils.rotateVRCamera(obj, _pGlob.AXIS_Z, v3d.MathUtils.degToRad(zVal));
            } else {
              obj.rotateX(v3d.MathUtils.degToRad(xVal));
              obj.rotateY(v3d.MathUtils.degToRad(yVal));
              obj.rotateZ(v3d.MathUtils.degToRad(zVal));
            }
            break;
          case "scale":
            obj.scale.x *= xVal;
            obj.scale.y *= yVal;
            obj.scale.z *= zVal;
            break;
        }

        obj.updateMatrixWorld(true);
      }
    }

    GetPickedObjectName(obj) {
      // auto-generated from a multi-material object, use parent name instead
      if (obj.isMesh && obj.isMaterialGeneratedMesh && obj.parent) {
        if (this.debugMode) {
          console.log('Picked with parent: ' + obj.parent.name);
        }
        return obj.parent.name;
      } else {
        if (this.debugMode) {
          console.log('Picked: ' + obj.name);
        }
        return obj.name;
      }
    }

    ObjectsIncludeObj(objNames, testedObjName) {
      if (!testedObjName) return false;

      for (var i = 0; i < objNames.length; i++) {
        if (testedObjName == objNames[i]) {
          return true;
        } else {
          // also check children which are auto-generated for multi-material objects
          var obj = this.GetObjectByName(objNames[i]);
          if (obj && obj.type == "Group") {
            for (var j = 0; j < obj.children.length; j++) {
              if (testedObjName == obj.children[j].name) {
                return true;
              }
            }
          }
        }
      }
      return false;
    }

    InitObjectPicking(callback, eventType, mouseDownUseTouchStart, mouseButtons) {
      var elem = app.renderer.domElement;
      elem.addEventListener(eventType, pickListener);
      if (v3d.PL.editorEventListeners)
        v3d.PL.editorEventListeners.push([elem, eventType, pickListener]);

      if (eventType == 'mousedown') {

        var touchEventName = mouseDownUseTouchStart ? 'touchstart' : 'touchend';
        elem.addEventListener(touchEventName, pickListener);
        if (v3d.PL.editorEventListeners)
          v3d.PL.editorEventListeners.push([elem, touchEventName, pickListener]);

      } else if (eventType == 'dblclick') {

        var prevTapTime = 0;

        function doubleTapCallback(event) {

          var now = new Date().getTime();
          var timesince = now - prevTapTime;

          if (timesince < 600 && timesince > 0) {

            pickListener(event);
            prevTapTime = 0;
            return;

          }

          prevTapTime = new Date().getTime();
        }

        var touchEventName = mouseDownUseTouchStart ? 'touchstart' : 'touchend';
        elem.addEventListener(touchEventName, doubleTapCallback);
        if (v3d.PL.editorEventListeners)
          v3d.PL.editorEventListeners.push([elem, touchEventName, doubleTapCallback]);
      }

      var raycaster = new v3d.Raycaster();

      function pickListener(event) {

        // to handle unload in loadScene puzzle
        if (!app.getCamera())
          return;

        event.preventDefault();

        var xNorm = 0, yNorm = 0;
        if (event instanceof MouseEvent) {
          if (mouseButtons && mouseButtons.indexOf(event.button) == -1)
            return;
          xNorm = event.offsetX / elem.clientWidth;
          yNorm = event.offsetY / elem.clientHeight;
        } else if (event instanceof TouchEvent) {
          var rect = elem.getBoundingClientRect();
          xNorm = (event.changedTouches[0].clientX - rect.left) / rect.width;
          yNorm = (event.changedTouches[0].clientY - rect.top) / rect.height;
        }

        _pGlob.screenCoords.x = xNorm * 2 - 1;
        _pGlob.screenCoords.y = -yNorm * 2 + 1;
        raycaster.setFromCamera(_pGlob.screenCoords, app.getCamera(true));
        var objList = [];
        app.scene.traverse(function (obj) { objList.push(obj); });
        var intersects = raycaster.intersectObjects(objList);
        callback(intersects, event);
      }
    }

    SaveState(objs, vars) {
      var objsState = {};
      var objsSelector = objs;
      var savedScene;
      var sceneIds = { 's2c': {}, 'c2s': {} };

      objs = this.RetrieveObjectNames(objs) || [];

      if (objs.length > 0) {
        // save scene
        var scene = app.scene;
        if (scene) {
          savedScenes = new v3d.Object3D();
          savedScene.copy(scene);

          savedScene.traverse(function (child) {
            if (child) {
              var obj = scene.getObjectByName(child.name);
              if (obj) {
                sceneIds['s2c'][child.id] = obj.id;
                sceneIds['c2s'][obj.id] = child.id;
              }
            }
          });
        }

        // save selector's objects
        for (var i = 0; i < objs.length; i++) {
          var objName = objs[i];

          if (objName) {
            var obj = this.GetObjectByName(objName);
            if (obj) {
              var objSaved = obj.id;
              objsState[objName] = objSaved;
            } else {
              objsState[objName] = null;
            }
          }
        }
      }

      var varsState = {};
      for (var i = 0; i < vars.length; i++) {
        var varName = vars[i];
        if (varName)
          varsState[varName] = JSON.stringify(eval(varName));
      }

      _pGlob.states.push({
        objects: objsState,
        scene: savedScene,
        ids: sceneIds,
        variables: varsState,
        selector: objsSelector
      });

    }

    UndoState() {
      var state = _pGlob.states.pop();
      if (!state)
        return;

      var objsState = state.objects || {};
      var savedScene = state.scene;
      var objs = this.RetrieveObjectNames(state.selector) || [];
      var removeObjs = {};

      //dictionary of saved and current object's id equivalents
      var savedSceneIds = state.ids;
      //get current scene object's saved equivalent
      var idCurrentToSaved = function (id, newId = null) {
        if (newId)
          savedSceneIds['c2s'][id] = newId;
        else
          return savedSceneIds['c2s'][id];
      }
      //get saved object's equivalent in current scene
      var idSavedToCurrent = function (id, newId = null) {
        if (newId)
          savedSceneIds['s2c'][id] = newId;
        else
          return savedSceneIds['s2c'][id];
      }

      //check if object was not saved - delete
      for (var i = 0; i < objs.length; i++) {
        var objName = objs[i];
        if (objName) {
          var obj = this.GetObjectByName(objName);

          if (obj) {
            if (!objsState[objName]) {
              removeObjs[obj.id] = obj;
            }
          }
        }
      }

      var ignoreObjs = {};
      if (savedScene) {
        var scene = app.scene;
        if (scene) {
          for (var objName in objsState) {
            if (objName) {

              var objId = objsState[objName]; // current scene object's id
              var objSaved = savedScene.getObjectById(idCurrentToSaved(objId));
              var obj = scene.getObjectById(objId);

              if (!obj && !ignoreObjs[objSaved.id]) {
                if (objSaved.parent) {
                  var parent = scene.getObjectById(idSavedToCurrent(objSaved.parent.id));
                  if (parent) {
                    obj = objSaved.clone(false);
                    parent.add(obj);

                    idSavedToCurrent(objSaved.id, obj.id);
                    idCurrentToSaved(obj.id, objSaved.id);

                    objId = obj.id;
                    objsState[objName] = objId;
                  }
                }
              }

              if (obj && !ignoreObjs[idCurrentToSaved(objId)]) {
                //copy object and object's childs
                objSaved.traverse(function (savedChild) {
                  if (savedChild && !ignoreObjs[savedChild.id]) {
                    var objChild = scene.getObjectById(idSavedToCurrent(savedChild.id));

                    if (objChild) {
                      if (removeObjs[objChild.id]) {
                        delete removeObjs[objChild.id];
                      }
                      // copy attributes and set parent
                      if (objChild.type != "Scene") {
                        if (savedChild.parent) {
                          objChild.copy(savedChild, false);
                          var parent = scene.getObjectById(idSavedToCurrent(savedChild.parent.id));
                          if (parent) {
                            parent.add(objChild);
                          }
                        }
                      }

                      //compare object childs
                      var savedChildsDict = {};
                      for (var i = 0; i < savedChild.children.length; i++) {
                        var child = savedChild.children[i];
                        if (child) {
                          savedChildsDict[child.id] = child;
                        }
                      }
                      //if child wasn't saved then delete it
                      for (var i = 0; i < objChild.children.length; i++) {
                        var child = objChild.children[i];
                        if (child) {
                          if (savedChildsDict[idCurrentToSaved(child.id)]) {
                            delete savedChildsDict[idCurrentToSaved(child.id)];
                          } else {
                            removeObjs[child.id] = child;
                          }
                        }
                      }

                      //if saved child doesn't exist add it
                      for (var id in savedChildsDict) {
                        // it child in scene then parent it to obj, else clone
                        var child = scene.getObjectById(idSavedToCurrent(id));
                        child = child ? child : savedChildsDict[id].clone(false);
                        objChild.add(child);
                        idSavedToCurrent(id, child.id);
                        idCurrentToSaved(child.id, id);
                      }

                      ignoreObjs[savedChild.id] = true;
                    } else {
                      if (this.debugMode) {
                        console.log("Error, object doesn't exist", savedChild.name);
                      }
                    }
                  }
                });
              }
            }
          }
        }
      }

      for (var objId in removeObjs) {
        if (objId) {
          var obj = removeObjs[objId];
          if (obj) {
            obj.removeFromParent();
            // clean object cache
            _pGlob.objCache = {};
          }
        }
      }

      var varsState = state.variables;

      for (var varName in varsState) {
        eval(varName + '=' + varsState[varName]);
      }
    }

    CoordsTransform(coords, from, to, noSignChange) {

      if (from == to)
        return coords;

      var y = coords.y, z = coords.z;

      if (from == 'Z_UP_RIGHT' && to == 'Y_UP_RIGHT') {
        coords.y = z;
        coords.z = noSignChange ? y : -y;
      } else if (from == 'Y_UP_RIGHT' && to == 'Z_UP_RIGHT') {
        coords.y = noSignChange ? z : -z;
        coords.z = y;
      } else {
        console.error('coordsTransform: Unsupported coordinate space');
      }

      return coords;
    }

    GetCoordSystem() {
      var scene = app.scene;

      if (scene && "v3d" in scene.userData && "coordSystem" in scene.userData.v3d) {
        return scene.userData.v3d.coordSystem;
      } else {
        // COMPAT: <2.17, consider replacing to 'Y_UP_RIGHT' for scenes with unknown origin
        return 'Z_UP_RIGHT';
      }
    }

    FeatureAvailable(feature) {
      var userAgent = window.navigator.userAgent;
      var platform = window.navigator.platform;
  
      switch (feature) {
        case 'LINUX':
          return /Linux/.test(platform);
        case 'WINDOWS':
          return ['Win32', 'Win64', 'Windows', 'WinCE'].indexOf(platform) !== -1;
        case 'MACOS':
          return (['Macintosh', 'MacIntel', 'MacPPC', 'Mac68K'].indexOf(platform) !== -1 && !v3d.Detector.checkIOS());
        case 'IOS':
          return v3d.Detector.checkIOS();
        case 'ANDROID':
          return /Android/i.test(userAgent);
        case 'MOBILE':
          return (/Android|webOS|BlackBerry/i.test(userAgent) || v3d.Detector.checkIOS());
  
        case 'CHROME':
          // Chromium based
          return (!!window.chrome && !/Edge/.test(navigator.userAgent));
        case 'FIREFOX':
          return /Firefox/.test(navigator.userAgent);
        case 'IE':
          return /Trident/.test(navigator.userAgent);
        case 'EDGE':
          return /Edge/.test(navigator.userAgent);
        case 'SAFARI':
          return (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent));
  
        case 'TOUCH':
          return !!(('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch);
        case 'RETINA':
          return window.devicePixelRatio >= 2;
        case 'HDR':
          return appInstance.useHDR;
        case 'WEBAUDIO':
          return v3d.Detector.checkWebAudio();
        case 'WEBGL2':
          var canvas = document.createElement('canvas');
          var gl = canvas.getContext('webgl2')
          return !!gl;
        case 'WOOCOMMERCE':
          var woo_fun = window.parent.v3d_woo_get_product_info || window.parent.parent.v3d_woo_get_product_info;
          return !!woo_fun;
        case 'DO_NOT_TRACK':
          if (navigator.doNotTrack == '1' || window.doNotTrack == '1')
            return true;
          else
            return false;
        default:
          return false;
      }
    }
    
  }

  function RotationInterface() {
    /**
     * For user manipulations use XYZ extrinsic rotations (which
     * are the same as ZYX intrinsic rotations)
     *     - Blender/Max/Maya use extrinsic rotations in the UI
     *     - XYZ is the default option, but could be set from
     *       some order hint if exported
     */
    this._userRotation = new v3d.Euler(0, 0, 0, 'ZYX');
    this._actualRotation = new v3d.Euler();
  }

  Object.assign(RotationInterface, {
    initObject: function (obj) {
      if (obj.userData.v3d.puzzles === undefined) {
        obj.userData.v3d.puzzles = {}
      }
      if (obj.userData.v3d.puzzles.rotationInterface === undefined) {
        obj.userData.v3d.puzzles.rotationInterface = new RotationInterface();
      }

      var rotUI = obj.userData.v3d.puzzles.rotationInterface;
      rotUI.updateFromObject(obj);
      return rotUI;
    }
  });

  Object.assign(RotationInterface.prototype, {

    updateFromObject: function (obj) {
      var SYNC_ROT_EPS = 1e-8;

      if (!this._actualRotation.equalsEps(obj.rotation, SYNC_ROT_EPS)) {
        this._actualRotation.copy(obj.rotation);
        this._updateUserRotFromActualRot();
      }
    },

    getActualRotation: function (euler) {
      return euler.copy(this._actualRotation);
    },

    setUserRotation: function (euler) {
      // don't copy the order, since it's fixed to ZYX for now
      this._userRotation.set(euler.x, euler.y, euler.z);
      this._updateActualRotFromUserRot();
    },

    getUserRotation: function (euler) {
      return euler.copy(this._userRotation);
    },

    _updateUserRotFromActualRot: function () {
      var order = this._userRotation.order;
      this._userRotation.copy(this._actualRotation).reorder(order);
    },

    _updateActualRotFromUserRot: function () {
      var order = this._actualRotation.order;
      this._actualRotation.copy(this._userRotation).reorder(order);
    }

  });

  _pGlob.getInputSource = function(controller) {
    if (controller && controller.userData.v3d && controller.userData.v3d.inputSource) {
        return controller.userData.v3d.inputSource
    } else {
        return null;
    }
  };

  _pGlob.traverseNonControllers = function(obj, callback) {

      if (obj.name.startsWith('XR_CONTROLLER_'))
          return;

      callback(obj);

      var children = obj.children;

      for (var i = 0, l = children.length; i < l; i++) {

          _pGlob.traverseNonControllers(children[i], callback);

      }

  };

  _pGlob.xrGetIntersections = function(controller) {

      controller.updateMatrixWorld(true);

      _pGlob.mat4Tmp.identity().extractRotation(controller.matrixWorld);

      var objList = [];

      _pGlob.traverseNonControllers(app.scene, function(obj) {
          objList.push(obj);
      });

      var raycaster = new v3d.Raycaster();
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_pGlob.mat4Tmp);

      return raycaster.intersectObjects(objList);

  }

  function retrieveObjectNames(objNames) {
    var acc = [];
    retrieveObjectNamesAcc(objNames, acc);
    return acc;
  }

  function getAllObjectNames() {
    var objNameList = [];
    app.scene.traverse(function(obj) {
      objNameList.push(obj.name)
    });
    return objNameList;
  }
  
  function retrieveObjectNamesAcc(currObjNames, acc) {
      if (typeof currObjNames == "string") {
          acc.push(currObjNames);
      } else if (Array.isArray(currObjNames) && currObjNames[0] == "GROUP") {
          var newObj = getObjectNamesByGroupName(currObjNames[1]);
          for (var i = 0; i < newObj.length; i++)
              acc.push(newObj[i]);
      } else if (Array.isArray(currObjNames) && currObjNames[0] == "ALL_OBJECTS") {
          var newObj = getAllObjectNames();
          for (var i = 0; i < newObj.length; i++)
              acc.push(newObj[i]);
      } else if (Array.isArray(currObjNames)) {
          for (var i = 0; i < currObjNames.length; i++)
              retrieveObjectNamesAcc(currObjNames[i], acc);
      }
  }

  function notIgnoredObj(obj) {
    return (obj.type !== "AmbientLight" && obj.name !== "" && !(obj.isMesh && obj.isMaterialGeneratedMesh));
  }

  function getObjectNamesByGroupName(targetGroupName) {
    var objNameList = [];
    app.scene.traverse(function(obj){
      if (notIgnoredObj(obj)) {
        var groupNames = obj.groupNames;
        if (!groupNames)
          return;
        for (var i = 0; i < groupNames.length; i++) {
          var groupName = groupNames[i];
          if (groupName == targetGroupName) {
              objNameList.push(obj.name);
          }
        }
      }
    });
    return objNameList;
  }
  
  function getPickedObjectName(obj) {
    // auto-generated from a multi-material object, use parent name instead
    if (obj.isMesh && obj.isMaterialGeneratedMesh && obj.parent) {
      // if (this.debugMode) {
      //   console.log('Picked with parent: ' + obj.parent.name);
      // }
      return obj.parent.name;
    } else {
      // if (this.debugMode) {
      //   console.log('Picked: ' + obj.name);
      // }
      return obj.name;
    }
  }

  function getObjectByName(objName) {
    var objFound;
    var runTime = _pGlob !== undefined;
    objFound = runTime ? _pGlob.objCache[objName] : null;

    if (objFound && objFound.name === objName)
      return objFound;

    app.scene.traverse(function (obj) {
      if (!objFound && (obj.name == objName)) {
        objFound = obj;
        if (runTime) {
          _pGlob.objCache[objName] = objFound;
        }
      }
    });
    return objFound;
  }

  function objectsIncludeObj(objNames, testedObjName) {
    if (!testedObjName) return false;

    for (var i = 0; i < objNames.length; i++) {
      if (testedObjName == objNames[i]) {
        return true;
      } else {
        // also check children which are auto-generated for multi-material objects
        var obj = getObjectByName(objNames[i]);
        if (obj && obj.type == "Group") {
          for (var j = 0; j < obj.children.length; j++) {
            if (testedObjName == obj.children[j].name) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  _pGlob.xrOnSelect = function(event) {
    if (!_pGlob.objClickInfo)
        return;

    var controller = event.target;

    var intersections = _pGlob.xrGetIntersections(controller);

    if (intersections.length > 0) {
        var intersection = intersections[0];
        var obj = intersection.object;

        // save the object for the pickedObject block
        _pGlob.pickedObject = getPickedObjectName(obj);

        _pGlob.objClickInfo.forEach(function(el) {
            var isPicked = obj && objectsIncludeObj(retrieveObjectNames(el.objSelector), getPickedObjectName(obj));
            el.callbacks[isPicked ? 0 : 1]();
        });
    } else {
        _pGlob.objClickInfo.forEach(function(el) {
            // missed
            el.callbacks[1]();
        });
    }
  }
  
});

// USDZ Exporter
(function() {

  class USDZExporter {

      async parse(scene) {

          const files = {};
          const modelFileName = 'model.usda'; // model file should be first in USDZ archive so we init it here

          files[modelFileName] = null;
          let output = buildHeader();
          const materials = {};
          const textures = {};
          if (this.debugMode) {
            console.log('traversing visible');
          }
          scene.traverseVisible(object => {

              if (object.isMesh && object.material.isMeshStandardMaterial) {
                if (this.debugMode) {
                  console.log('meshStandardMaterial');
                }

                  const geometry = object.geometry;
                  const material = object.material;
                  const geometryFileName = 'geometries/Geometry_' + geometry.id + '.usd';

                  if (!(geometryFileName in files)) {

                      const meshObject = buildMeshObject(geometry);
                      files[geometryFileName] = buildUSDFileAsString(meshObject);

                  }

                  if (!(material.uuid in materials)) {

                      materials[material.uuid] = material;

                  }

                  output += buildXform(object, geometry, material);

              } else {
                if (this.debugMode) {
                  console.log('Not a mesh standard material');
                }
              }

          });
          output += buildMaterials(materials, textures);
          files[modelFileName] = fflate.strToU8(output);
          output = null;

          for (const id in textures) {

              const texture = textures[id];
              const color = id.split('_')[1];
              files['textures/Texture_' + id + '.jpg'] = await imgToU8(texture.image, color);

          } // 64 byte alignment
          // https://github.com/101arrowz/fflate/issues/39#issuecomment-777263109


          let offset = 0;

          for (const filename in files) {

              const file = files[filename];
              const headerSize = 34 + filename.length;
              offset += headerSize;
              const offsetMod64 = offset & 63;

              if (offsetMod64 !== 4) {

                  const padLength = 64 - offsetMod64;
                  const padding = new Uint8Array(padLength);
                  files[filename] = [file, {
                      extra: {
                          12345: padding
                      }
                  }];

              }

              offset = file.length;

          }

          return fflate.zipSync(files, {
              level: 0
          });

      }

  }

  async function imgToU8(image, color) {

      if (typeof HTMLImageElement !== 'undefined' && image instanceof HTMLImageElement || typeof HTMLCanvasElement !== 'undefined' && image instanceof HTMLCanvasElement || typeof OffscreenCanvas !== 'undefined' && image instanceof OffscreenCanvas || typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap) {

          const scale = 1024 / Math.max(image.width, image.height);
          const canvas = document.createElement('canvas');
          canvas.width = image.width * Math.min(1, scale);
          canvas.height = image.height * Math.min(1, scale);
          const context = canvas.getContext('2d');
          context.drawImage(image, 0, 0, canvas.width, canvas.height);

          if (color !== undefined) {

              context.globalCompositeOperation = 'multiply';
              context.fillStyle = `#${color}`;
              context.fillRect(0, 0, canvas.width, canvas.height);

          }

          const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 1));
          return new Uint8Array(await blob.arrayBuffer());

      }

  } //


  const PRECISION = 7;

  function buildHeader() {

      return `#usda 1.0
(
  customLayerData = {
      string creator = "Three.js USDZExporter"
  }
  metersPerUnit = 1
  upAxis = "Y"
)

`;

  }

  function buildUSDFileAsString(dataToInsert) {

      let output = buildHeader();
      output += dataToInsert;
      return fflate.strToU8(output);

  } // Xform


  function buildXform(object, geometry, material) {

      const name = 'Object_' + object.id;
      const transform = buildMatrix(object.matrixWorld);
      return `def Xform "${name}" (
  prepend references = @./geometries/Geometry_${geometry.id}.usd@</Geometry>
)
{
  matrix4d xformOp:transform = ${transform}
  uniform token[] xformOpOrder = ["xformOp:transform"]

  rel material:binding = </Materials/Material_${material.id}>
}

`;

  }

  function buildMatrix(matrix) {

      const array = matrix.elements;
      return `(${buildMatrixRow(array, 0)}, ${buildMatrixRow(array, 4)}, ${buildMatrixRow(array, 8)}, ${buildMatrixRow(array, 12)})`;

  }

  function buildMatrixRow(array, offset) {

      return `(${array[offset + 0]}, ${array[offset + 1]}, ${array[offset + 2]}, ${array[offset + 3]})`;

  } // Mesh


  function buildMeshObject(geometry) {

      const mesh = buildMesh(geometry);
      return `
def "Geometry"
{
${mesh}
}
`;

  }

  function buildMesh(geometry) {

      const name = 'Geometry';
      const attributes = geometry.attributes;
      const count = attributes.position.count;
      return `
  def Mesh "${name}"
  {
      int[] faceVertexCounts = [${buildMeshVertexCount(geometry)}]
      int[] faceVertexIndices = [${buildMeshVertexIndices(geometry)}]
      normal3f[] normals = [${buildVector3Array(attributes.normal, count)}] (
          interpolation = "vertex"
      )
      point3f[] points = [${buildVector3Array(attributes.position, count)}]
      float2[] primvars:st = [${buildVector2Array(attributes.uv, count)}] (
          interpolation = "vertex"
      )
      uniform token subdivisionScheme = "none"
  }
`;

  }

  function buildMeshVertexCount(geometry) {

      const count = geometry.index !== null ? geometry.index.array.length : geometry.attributes.position.count;
      return Array(count / 3).fill(3).join(', ');

  }

  function buildMeshVertexIndices(geometry) {

      if (geometry.index !== null) {

          return geometry.index.array.join(', ');

      }

      const array = [];
      const length = geometry.attributes.position.count;

      for (let i = 0; i < length; i++) {

          array.push(i);

      }

      return array.join(', ');

  }

  function buildVector3Array(attribute, count) {

      if (attribute === undefined) {

          console.warn('USDZExporter: Normals missing.');
          return Array(count).fill('(0, 0, 0)').join(', ');

      }

      const array = [];
      const data = attribute.array;

      for (let i = 0; i < data.length; i += 3) {

          array.push(`(${data[i + 0].toPrecision(PRECISION)}, ${data[i + 1].toPrecision(PRECISION)}, ${data[i + 2].toPrecision(PRECISION)})`);

      }

      return array.join(', ');

  }

  function buildVector2Array(attribute, count) {

      if (attribute === undefined) {

          console.warn('USDZExporter: UVs missing.');
          return Array(count).fill('(0, 0)').join(', ');

      }

      const array = [];
      const data = attribute.array;

      for (let i = 0; i < data.length; i += 2) {

          array.push(`(${data[i + 0].toPrecision(PRECISION)}, ${1 - data[i + 1].toPrecision(PRECISION)})`);

      }

      return array.join(', ');

  } // Materials


  function buildMaterials(materials, textures) {

      const array = [];

      for (const uuid in materials) {

          const material = materials[uuid];
          array.push(buildMaterial(material, textures));

      }

      return `def "Materials"
{
${array.join('')}
}

`;

  }

  function buildMaterial(material, textures) {

      // https://graphics.pixar.com/usd/docs/UsdPreviewSurface-Proposal.html
      const pad = '            ';
      const inputs = [];
      const samplers = [];

      function buildTexture(texture, mapType, color) {

          const id = texture.id + (color ? '_' + color.getHexString() : '');
          textures[id] = texture;
          return `
      def Shader "Transform2d_${mapType}" (
          sdrMetadata = {
              string role = "math"
          }
      )
      {
          uniform token info:id = "UsdTransform2d"
          float2 inputs:in.connect = </Materials/Material_${material.id}/uvReader_st.outputs:result>
          float2 inputs:scale = ${buildVector2(texture.repeat)}
          float2 inputs:translation = ${buildVector2(texture.offset)}
          float2 outputs:result
      }

      def Shader "Texture_${texture.id}_${mapType}"
      {
          uniform token info:id = "UsdUVTexture"
          asset inputs:file = @textures/Texture_${id}.jpg@
          float2 inputs:st.connect = </Materials/Material_${material.id}/Transform2d_${mapType}.outputs:result>
          token inputs:wrapS = "repeat"
          token inputs:wrapT = "repeat"
          float outputs:r
          float outputs:g
          float outputs:b
          float3 outputs:rgb
      }`;

      }

      if (material.map !== null) {

          inputs.push(`${pad}color3f inputs:diffuseColor.connect = </Materials/Material_${material.id}/Texture_${material.map.id}_diffuse.outputs:rgb>`);
          samplers.push(buildTexture(material.map, 'diffuse', material.color));

      } else {

          inputs.push(`${pad}color3f inputs:diffuseColor = ${buildColor(material.color)}`);

      }

      if (material.emissiveMap !== null) {

          inputs.push(`${pad}color3f inputs:emissiveColor.connect = </Materials/Material_${material.id}/Texture_${material.emissiveMap.id}_emissive.outputs:rgb>`);
          samplers.push(buildTexture(material.emissiveMap, 'emissive'));

      } else if (material.emissive.getHex() > 0) {

          inputs.push(`${pad}color3f inputs:emissiveColor = ${buildColor(material.emissive)}`);

      }

      if (material.normalMap !== null) {

          inputs.push(`${pad}normal3f inputs:normal.connect = </Materials/Material_${material.id}/Texture_${material.normalMap.id}_normal.outputs:rgb>`);
          samplers.push(buildTexture(material.normalMap, 'normal'));

      }

      if (material.aoMap !== null) {

          inputs.push(`${pad}float inputs:occlusion.connect = </Materials/Material_${material.id}/Texture_${material.aoMap.id}_occlusion.outputs:r>`);
          samplers.push(buildTexture(material.aoMap, 'occlusion'));

      }

      if (material.roughnessMap !== null) {

          inputs.push(`${pad}float inputs:roughness.connect = </Materials/Material_${material.id}/Texture_${material.roughnessMap.id}_roughness.outputs:g>`);
          samplers.push(buildTexture(material.roughnessMap, 'roughness'));

      } else {

          inputs.push(`${pad}float inputs:roughness = ${material.roughness}`);

      }

      if (material.metalnessMap !== null) {

          inputs.push(`${pad}float inputs:metallic.connect = </Materials/Material_${material.id}/Texture_${material.metalnessMap.id}_metallic.outputs:b>`);
          samplers.push(buildTexture(material.metalnessMap, 'metallic'));

      } else {

          inputs.push(`${pad}float inputs:metallic = ${material.metalness}`);

      }

      inputs.push(`${pad}float inputs:opacity = ${material.opacity}`);

      if (material.isMeshPhysicalMaterial) {

          inputs.push(`${pad}float inputs:clearcoat = ${material.clearcoat}`);
          inputs.push(`${pad}float inputs:clearcoatRoughness = ${material.clearcoatRoughness}`);
          inputs.push(`${pad}float inputs:ior = ${material.ior}`);

      }

      return `
  def Material "Material_${material.id}"
  {
      def Shader "PreviewSurface"
      {
          uniform token info:id = "UsdPreviewSurface"
${inputs.join('\n')}
          int inputs:useSpecularWorkflow = 0
          token outputs:surface
      }

      token outputs:surface.connect = </Materials/Material_${material.id}/PreviewSurface.outputs:surface>
      token inputs:frame:stPrimvarName = "st"

      def Shader "uvReader_st"
      {
          uniform token info:id = "UsdPrimvarReader_float2"
          token inputs:varname.connect = </Materials/Material_${material.id}.inputs:frame:stPrimvarName>
          float2 inputs:fallback = (0.0, 0.0)
          float2 outputs:result
      }

${samplers.join('\n')}

  }
`;

  }

  function buildColor(color) {

      return `(${color.r}, ${color.g}, ${color.b})`;

  }

  function buildVector2(vector) {

      return `(${vector.x}, ${vector.y})`;

  }

  v3d.USDZExporter = USDZExporter;

})();
/*!
fflate - fast JavaScript compression/decompression
<https://101arrowz.github.io/fflate>
Licensed under MIT. https://github.com/101arrowz/fflate/blob/master/LICENSE
version 0.6.9
*/
!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fflate',f]):(typeof self!='undefined'?self:this).fflate=f()}(function(){var _e={};"use strict";var t=(typeof module!='undefined'&&typeof exports=='object'?function(_f){"use strict";var e,t=";var __w=require('worker_threads');__w.parentPort.on('message',function(m){onmessage({data:m})}),postMessage=function(m,t){__w.parentPort.postMessage(m,t)},close=process.exit;self=global";try{e=require("worker_threads").Worker}catch(e){}exports.default=e?function(r,n,o,a,s){var u=!1,i=new e(r+t,{eval:!0}).on("error",(function(e){return s(e,null)})).on("message",(function(e){return s(null,e)})).on("exit",(function(e){e&&!u&&s(Error("exited with code "+e),null)}));return i.postMessage(o,a),i.terminate=function(){return u=!0,e.prototype.terminate.call(i)},i}:function(e,t,r,n,o){setImmediate((function(){return o(Error("async operations unsupported - update to Node 12+ (or Node 10-11 with the --experimental-worker CLI flag)"),null)}));var a=function(){};return{terminate:a,postMessage:a}};return _f}:function(_f){"use strict";var e={},r=function(e){return URL.createObjectURL(new Blob([e],{type:"text/javascript"}))},t=function(e){return new Worker(e)};try{URL.revokeObjectURL(r(""))}catch(e){r=function(e){return"data:application/javascript;charset=UTF-8,"+encodeURI(e)},t=function(e){return new Worker(e,{type:"module"})}}_f.default=function(n,o,u,a,c){var i=t(e[o]||(e[o]=r(n)));return i.onerror=function(e){return c(e.error,null)},i.onmessage=function(e){return c(null,e.data)},i.postMessage(u,a),i};return _f})({}),n=Uint8Array,r=Uint16Array,e=Uint32Array,i=new n([0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0,0]),o=new n([0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,10,11,11,12,12,13,13,0,0]),a=new n([16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15]),s=function(t,n){for(var i=new r(31),o=0;o<31;++o)i[o]=n+=1<<t[o-1];var a=new e(i[30]);for(o=1;o<30;++o)for(var s=i[o];s<i[o+1];++s)a[s]=s-i[o]<<5|o;return[i,a]},f=s(i,2),u=f[0],h=f[1];u[28]=258,h[258]=28;for(var c=s(o,0),l=c[0],p=c[1],v=new r(32768),d=0;d<32768;++d){var g=(43690&d)>>>1|(21845&d)<<1;v[d]=((65280&(g=(61680&(g=(52428&g)>>>2|(13107&g)<<2))>>>4|(3855&g)<<4))>>>8|(255&g)<<8)>>>1}var w=function(t,n,e){for(var i=t.length,o=0,a=new r(n);o<i;++o)++a[t[o]-1];var s,f=new r(n);for(o=0;o<n;++o)f[o]=f[o-1]+a[o-1]<<1;if(e){s=new r(1<<n);var u=15-n;for(o=0;o<i;++o)if(t[o])for(var h=o<<4|t[o],c=n-t[o],l=f[t[o]-1]++<<c,p=l|(1<<c)-1;l<=p;++l)s[v[l]>>>u]=h}else for(s=new r(i),o=0;o<i;++o)t[o]&&(s[o]=v[f[t[o]-1]++]>>>15-t[o]);return s},y=new n(288);for(d=0;d<144;++d)y[d]=8;for(d=144;d<256;++d)y[d]=9;for(d=256;d<280;++d)y[d]=7;for(d=280;d<288;++d)y[d]=8;var m=new n(32);for(d=0;d<32;++d)m[d]=5;var b=w(y,9,0),x=w(y,9,1),z=w(m,5,0),k=w(m,5,1),M=function(t){for(var n=t[0],r=1;r<t.length;++r)t[r]>n&&(n=t[r]);return n},A=function(t,n,r){var e=n/8|0;return(t[e]|t[e+1]<<8)>>(7&n)&r},S=function(t,n){var r=n/8|0;return(t[r]|t[r+1]<<8|t[r+2]<<16)>>(7&n)},D=function(t){return(t/8|0)+(7&t&&1)},C=function(t,i,o){(null==i||i<0)&&(i=0),(null==o||o>t.length)&&(o=t.length);var a=new(t instanceof r?r:t instanceof e?e:n)(o-i);return a.set(t.subarray(i,o)),a},U=function(t,r,e){var s=t.length;if(!s||e&&!e.l&&s<5)return r||new n(0);var f=!r||e,h=!e||e.i;e||(e={}),r||(r=new n(3*s));var c=function(t){var e=r.length;if(t>e){var i=new n(Math.max(2*e,t));i.set(r),r=i}},p=e.f||0,v=e.p||0,d=e.b||0,g=e.l,y=e.d,m=e.m,b=e.n,z=8*s;do{if(!g){e.f=p=A(t,v,1);var U=A(t,v+1,3);if(v+=3,!U){var O=t[(Y=D(v)+4)-4]|t[Y-3]<<8,T=Y+O;if(T>s){if(h)throw"unexpected EOF";break}f&&c(d+O),r.set(t.subarray(Y,T),d),e.b=d+=O,e.p=v=8*T;continue}if(1==U)g=x,y=k,m=9,b=5;else{if(2!=U)throw"invalid block type";var Z=A(t,v,31)+257,I=A(t,v+10,15)+4,F=Z+A(t,v+5,31)+1;v+=14;for(var E=new n(F),G=new n(19),P=0;P<I;++P)G[a[P]]=A(t,v+3*P,7);v+=3*I;var j=M(G),q=(1<<j)-1,H=w(G,j,1);for(P=0;P<F;){var Y,B=H[A(t,v,q)];if(v+=15&B,(Y=B>>>4)<16)E[P++]=Y;else{var J=0,K=0;for(16==Y?(K=3+A(t,v,3),v+=2,J=E[P-1]):17==Y?(K=3+A(t,v,7),v+=3):18==Y&&(K=11+A(t,v,127),v+=7);K--;)E[P++]=J}}var L=E.subarray(0,Z),N=E.subarray(Z);m=M(L),b=M(N),g=w(L,m,1),y=w(N,b,1)}if(v>z){if(h)throw"unexpected EOF";break}}f&&c(d+131072);for(var Q=(1<<m)-1,R=(1<<b)-1,V=v;;V=v){var W=(J=g[S(t,v)&Q])>>>4;if((v+=15&J)>z){if(h)throw"unexpected EOF";break}if(!J)throw"invalid length/literal";if(W<256)r[d++]=W;else{if(256==W){V=v,g=null;break}var X=W-254;W>264&&(X=A(t,v,(1<<(tt=i[P=W-257]))-1)+u[P],v+=tt);var $=y[S(t,v)&R],_=$>>>4;if(!$)throw"invalid distance";if(v+=15&$,N=l[_],_>3){var tt=o[_];N+=S(t,v)&(1<<tt)-1,v+=tt}if(v>z){if(h)throw"unexpected EOF";break}f&&c(d+131072);for(var nt=d+X;d<nt;d+=4)r[d]=r[d-N],r[d+1]=r[d+1-N],r[d+2]=r[d+2-N],r[d+3]=r[d+3-N];d=nt}}e.l=g,e.p=V,e.b=d,g&&(p=1,e.m=m,e.d=y,e.n=b)}while(!p);return d==r.length?r:C(r,0,d)},O=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8},T=function(t,n,r){var e=n/8|0;t[e]|=r<<=7&n,t[e+1]|=r>>>8,t[e+2]|=r>>>16},Z=function(t,e){for(var i=[],o=0;o<t.length;++o)t[o]&&i.push({s:o,f:t[o]});var a=i.length,s=i.slice();if(!a)return[q,0];if(1==a){var f=new n(i[0].s+1);return f[i[0].s]=1,[f,1]}i.sort((function(t,n){return t.f-n.f})),i.push({s:-1,f:25001});var u=i[0],h=i[1],c=0,l=1,p=2;for(i[0]={s:-1,f:u.f+h.f,l:u,r:h};l!=a-1;)u=i[i[c].f<i[p].f?c++:p++],h=i[c!=l&&i[c].f<i[p].f?c++:p++],i[l++]={s:-1,f:u.f+h.f,l:u,r:h};var v=s[0].s;for(o=1;o<a;++o)s[o].s>v&&(v=s[o].s);var d=new r(v+1),g=I(i[l-1],d,0);if(g>e){o=0;var w=0,y=g-e,m=1<<y;for(s.sort((function(t,n){return d[n.s]-d[t.s]||t.f-n.f}));o<a;++o){var b=s[o].s;if(!(d[b]>e))break;w+=m-(1<<g-d[b]),d[b]=e}for(w>>>=y;w>0;){var x=s[o].s;d[x]<e?w-=1<<e-d[x]++-1:++o}for(;o>=0&&w;--o){var z=s[o].s;d[z]==e&&(--d[z],++w)}g=e}return[new n(d),g]},I=function(t,n,r){return-1==t.s?Math.max(I(t.l,n,r+1),I(t.r,n,r+1)):n[t.s]=r},F=function(t){for(var n=t.length;n&&!t[--n];);for(var e=new r(++n),i=0,o=t[0],a=1,s=function(t){e[i++]=t},f=1;f<=n;++f)if(t[f]==o&&f!=n)++a;else{if(!o&&a>2){for(;a>138;a-=138)s(32754);a>2&&(s(a>10?a-11<<5|28690:a-3<<5|12305),a=0)}else if(a>3){for(s(o),--a;a>6;a-=6)s(8304);a>2&&(s(a-3<<5|8208),a=0)}for(;a--;)s(o);a=1,o=t[f]}return[e.subarray(0,i),n]},E=function(t,n){for(var r=0,e=0;e<n.length;++e)r+=t[e]*n[e];return r},G=function(t,n,r){var e=r.length,i=D(n+2);t[i]=255&e,t[i+1]=e>>>8,t[i+2]=255^t[i],t[i+3]=255^t[i+1];for(var o=0;o<e;++o)t[i+o+4]=r[o];return 8*(i+4+e)},P=function(t,n,e,s,f,u,h,c,l,p,v){O(n,v++,e),++f[256];for(var d=Z(f,15),g=d[0],x=d[1],k=Z(u,15),M=k[0],A=k[1],S=F(g),D=S[0],C=S[1],U=F(M),I=U[0],P=U[1],j=new r(19),q=0;q<D.length;++q)j[31&D[q]]++;for(q=0;q<I.length;++q)j[31&I[q]]++;for(var H=Z(j,7),Y=H[0],B=H[1],J=19;J>4&&!Y[a[J-1]];--J);var K,L,N,Q,R=p+5<<3,V=E(f,y)+E(u,m)+h,W=E(f,g)+E(u,M)+h+14+3*J+E(j,Y)+(2*j[16]+3*j[17]+7*j[18]);if(R<=V&&R<=W)return G(n,v,t.subarray(l,l+p));if(O(n,v,1+(W<V)),v+=2,W<V){K=w(g,x,0),L=g,N=w(M,A,0),Q=M;var X=w(Y,B,0);for(O(n,v,C-257),O(n,v+5,P-1),O(n,v+10,J-4),v+=14,q=0;q<J;++q)O(n,v+3*q,Y[a[q]]);v+=3*J;for(var $=[D,I],_=0;_<2;++_){var tt=$[_];for(q=0;q<tt.length;++q)O(n,v,X[nt=31&tt[q]]),v+=Y[nt],nt>15&&(O(n,v,tt[q]>>>5&127),v+=tt[q]>>>12)}}else K=b,L=y,N=z,Q=m;for(q=0;q<c;++q)if(s[q]>255){var nt;T(n,v,K[257+(nt=s[q]>>>18&31)]),v+=L[nt+257],nt>7&&(O(n,v,s[q]>>>23&31),v+=i[nt]);var rt=31&s[q];T(n,v,N[rt]),v+=Q[rt],rt>3&&(T(n,v,s[q]>>>5&8191),v+=o[rt])}else T(n,v,K[s[q]]),v+=L[s[q]];return T(n,v,K[256]),v+L[256]},j=new e([65540,131080,131088,131104,262176,1048704,1048832,2114560,2117632]),q=new n(0),H=function(t,a,s,f,u,c){var l=t.length,v=new n(f+l+5*(1+Math.ceil(l/7e3))+u),d=v.subarray(f,v.length-u),g=0;if(!a||l<8)for(var w=0;w<=l;w+=65535){var y=w+65535;y<l?g=G(d,g,t.subarray(w,y)):(d[w]=c,g=G(d,g,t.subarray(w,l)))}else{for(var m=j[a-1],b=m>>>13,x=8191&m,z=(1<<s)-1,k=new r(32768),M=new r(z+1),A=Math.ceil(s/3),S=2*A,U=function(n){return(t[n]^t[n+1]<<A^t[n+2]<<S)&z},O=new e(25e3),T=new r(288),Z=new r(32),I=0,F=0,E=(w=0,0),H=0,Y=0;w<l;++w){var B=U(w),J=32767&w,K=M[B];if(k[J]=K,M[B]=J,H<=w){var L=l-w;if((I>7e3||E>24576)&&L>423){g=P(t,d,0,O,T,Z,F,E,Y,w-Y,g),E=I=F=0,Y=w;for(var N=0;N<286;++N)T[N]=0;for(N=0;N<30;++N)Z[N]=0}var Q=2,R=0,V=x,W=J-K&32767;if(L>2&&B==U(w-W))for(var X=Math.min(b,L)-1,$=Math.min(32767,w),_=Math.min(258,L);W<=$&&--V&&J!=K;){if(t[w+Q]==t[w+Q-W]){for(var tt=0;tt<_&&t[w+tt]==t[w+tt-W];++tt);if(tt>Q){if(Q=tt,R=W,tt>X)break;var nt=Math.min(W,tt-2),rt=0;for(N=0;N<nt;++N){var et=w-W+N+32768&32767,it=et-k[et]+32768&32767;it>rt&&(rt=it,K=et)}}}W+=(J=K)-(K=k[J])+32768&32767}if(R){O[E++]=268435456|h[Q]<<18|p[R];var ot=31&h[Q],at=31&p[R];F+=i[ot]+o[at],++T[257+ot],++Z[at],H=w+Q,++I}else O[E++]=t[w],++T[t[w]]}}g=P(t,d,c,O,T,Z,F,E,Y,w-Y,g),!c&&7&g&&(g=G(d,g+1,q))}return C(v,0,f+D(g)+u)},Y=function(){for(var t=new e(256),n=0;n<256;++n){for(var r=n,i=9;--i;)r=(1&r&&3988292384)^r>>>1;t[n]=r}return t}(),B=function(){var t=-1;return{p:function(n){for(var r=t,e=0;e<n.length;++e)r=Y[255&r^n[e]]^r>>>8;t=r},d:function(){return~t}}},J=function(){var t=1,n=0;return{p:function(r){for(var e=t,i=n,o=r.length,a=0;a!=o;){for(var s=Math.min(a+2655,o);a<s;++a)i+=e+=r[a];e=(65535&e)+15*(e>>16),i=(65535&i)+15*(i>>16)}t=e,n=i},d:function(){return(255&(t%=65521))<<24|t>>>8<<16|(255&(n%=65521))<<8|n>>>8}}},K=function(t,n,r,e,i){return H(t,null==n.level?6:n.level,null==n.mem?Math.ceil(1.5*Math.max(8,Math.min(13,Math.log(t.length)))):12+n.mem,r,e,!i)},L=function(t,n){var r={};for(var e in t)r[e]=t[e];for(var e in n)r[e]=n[e];return r},N=function(t,n,r){for(var e=t(),i=""+t,o=i.slice(i.indexOf("[")+1,i.lastIndexOf("]")).replace(/ /g,"").split(","),a=0;a<e.length;++a){var s=e[a],f=o[a];if("function"==typeof s){n+=";"+f+"=";var u=""+s;if(s.prototype)if(-1!=u.indexOf("[native code]")){var h=u.indexOf(" ",8)+1;n+=u.slice(h,u.indexOf("(",h))}else for(var c in n+=u,s.prototype)n+=";"+f+".prototype."+c+"="+s.prototype[c];else n+=u}else r[f]=s}return[n,r]},Q=[],R=function(t){var i=[];for(var o in t)(t[o]instanceof n||t[o]instanceof r||t[o]instanceof e)&&i.push((t[o]=new t[o].constructor(t[o])).buffer);return i},V=function(n,r,e,i){var o;if(!Q[e]){for(var a="",s={},f=n.length-1,u=0;u<f;++u)a=(o=N(n[u],a,s))[0],s=o[1];Q[e]=N(n[f],a,s)}var h=L({},Q[e][1]);return t.default(Q[e][0]+";onmessage=function(e){for(var k in e.data)self[k]=e.data[k];onmessage="+r+"}",e,h,R(h),i)},W=function(){return[n,r,e,i,o,a,u,l,x,k,v,w,M,A,S,D,C,U,At,rt,et]},X=function(){return[n,r,e,i,o,a,h,p,b,y,z,m,v,j,q,w,O,T,Z,I,F,E,G,P,D,C,H,K,xt,rt]},$=function(){return[ct,vt,ht,B,Y]},_=function(){return[lt,pt]},tt=function(){return[dt,ht,J]},nt=function(){return[gt]},rt=function(t){return postMessage(t,[t.buffer])},et=function(t){return t&&t.size&&new n(t.size)},it=function(t,n,r,e,i,o){var a=V(r,e,i,(function(t,n){a.terminate(),o(t,n)}));return a.postMessage([t,n],n.consume?[t.buffer]:[]),function(){a.terminate()}},ot=function(t){return t.ondata=function(t,n){return postMessage([t,n],[t.buffer])},function(n){return t.push(n.data[0],n.data[1])}},at=function(t,n,r,e,i){var o,a=V(t,e,i,(function(t,r){t?(a.terminate(),n.ondata.call(n,t)):(r[1]&&a.terminate(),n.ondata.call(n,t,r[0],r[1]))}));a.postMessage(r),n.push=function(t,r){if(o)throw"stream finished";if(!n.ondata)throw"no stream handler";a.postMessage([t,o=r],[t.buffer])},n.terminate=function(){a.terminate()}},st=function(t,n){return t[n]|t[n+1]<<8},ft=function(t,n){return(t[n]|t[n+1]<<8|t[n+2]<<16|t[n+3]<<24)>>>0},ut=function(t,n){return ft(t,n)+4294967296*ft(t,n+4)},ht=function(t,n,r){for(;r;++n)t[n]=r,r>>>=8},ct=function(t,n){var r=n.filename;if(t[0]=31,t[1]=139,t[2]=8,t[8]=n.level<2?4:9==n.level?2:0,t[9]=3,0!=n.mtime&&ht(t,4,Math.floor(new Date(n.mtime||Date.now())/1e3)),r){t[3]=8;for(var e=0;e<=r.length;++e)t[e+10]=r.charCodeAt(e)}},lt=function(t){if(31!=t[0]||139!=t[1]||8!=t[2])throw"invalid gzip data";var n=t[3],r=10;4&n&&(r+=t[10]|2+(t[11]<<8));for(var e=(n>>3&1)+(n>>4&1);e>0;e-=!t[r++]);return r+(2&n)},pt=function(t){var n=t.length;return(t[n-4]|t[n-3]<<8|t[n-2]<<16|t[n-1]<<24)>>>0},vt=function(t){return 10+(t.filename&&t.filename.length+1||0)},dt=function(t,n){var r=n.level,e=0==r?0:r<6?1:9==r?3:2;t[0]=120,t[1]=e<<6|(e?32-2*e:1)},gt=function(t){if(8!=(15&t[0])||t[0]>>>4>7||(t[0]<<8|t[1])%31)throw"invalid zlib data";if(32&t[1])throw"invalid zlib data: preset dictionaries not supported"};function wt(t,n){return n||"function"!=typeof t||(n=t,t={}),this.ondata=n,t}var yt=function(){function t(t,n){n||"function"!=typeof t||(n=t,t={}),this.ondata=n,this.o=t||{}}return t.prototype.p=function(t,n){this.ondata(K(t,this.o,0,0,!n),n)},t.prototype.push=function(t,n){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";this.d=n,this.p(t,n||!1)},t}();_e.Deflate=yt;var mt=function(){return function(t,n){at([X,function(){return[ot,yt]}],this,wt.call(this,t,n),(function(t){var n=new yt(t.data);onmessage=ot(n)}),6)}}();function bt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X],(function(t){return rt(xt(t.data[0],t.data[1]))}),0,r)}function xt(t,n){return K(t,n||{},0,0)}_e.AsyncDeflate=mt,_e.deflate=bt,_e.deflateSync=xt;var zt=function(){function t(t){this.s={},this.p=new n(0),this.ondata=t}return t.prototype.e=function(t){if(this.d)throw"stream finished";if(!this.ondata)throw"no stream handler";var r=this.p.length,e=new n(r+t.length);e.set(this.p),e.set(t,r),this.p=e},t.prototype.c=function(t){this.d=this.s.i=t||!1;var n=this.s.b,r=U(this.p,this.o,this.s);this.ondata(C(r,n,this.s.b),this.d),this.o=C(r,this.s.b-32768),this.s.b=this.o.length,this.p=C(this.p,this.s.p/8|0),this.s.p&=7},t.prototype.push=function(t,n){this.e(t),this.c(n)},t}();_e.Inflate=zt;var kt=function(){return function(t){this.ondata=t,at([W,function(){return[ot,zt]}],this,0,(function(){var t=new zt;onmessage=ot(t)}),7)}}();function Mt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W],(function(t){return rt(At(t.data[0],et(t.data[1])))}),1,r)}function At(t,n){return U(t,n)}_e.AsyncInflate=kt,_e.inflate=Mt,_e.inflateSync=At;var St=function(){function t(t,n){this.c=B(),this.l=0,this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t),this.l+=t.length;var r=K(t,this.o,this.v&&vt(this.o),n&&8,!n);this.v&&(ct(r,this.o),this.v=0),n&&(ht(r,r.length-8,this.c.d()),ht(r,r.length-4,this.l)),this.ondata(r,n)},t}();_e.Gzip=St,_e.Compress=St;var Dt=function(){return function(t,n){at([X,$,function(){return[ot,yt,St]}],this,wt.call(this,t,n),(function(t){var n=new St(t.data);onmessage=ot(n)}),8)}}();function Ct(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,$,function(){return[Ut]}],(function(t){return rt(Ut(t.data[0],t.data[1]))}),2,r)}function Ut(t,n){n||(n={});var r=B(),e=t.length;r.p(t);var i=K(t,n,vt(n),8),o=i.length;return ct(i,n),ht(i,o-8,r.d()),ht(i,o-4,e),i}_e.AsyncGzip=Dt,_e.AsyncCompress=Dt,_e.gzip=Ct,_e.compress=Ct,_e.gzipSync=Ut,_e.compressSync=Ut;var Ot=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){var r=this.p.length>3?lt(this.p):4;if(r>=this.p.length&&!n)return;this.p=this.p.subarray(r),this.v=0}if(n){if(this.p.length<8)throw"invalid gzip stream";this.p=this.p.subarray(0,-8)}zt.prototype.c.call(this,n)},t}();_e.Gunzip=Ot;var Tt=function(){return function(t){this.ondata=t,at([W,_,function(){return[ot,zt,Ot]}],this,0,(function(){var t=new Ot;onmessage=ot(t)}),9)}}();function Zt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,_,function(){return[It]}],(function(t){return rt(It(t.data[0]))}),3,r)}function It(t,r){return U(t.subarray(lt(t),-8),r||new n(pt(t)))}_e.AsyncGunzip=Tt,_e.gunzip=Zt,_e.gunzipSync=It;var Ft=function(){function t(t,n){this.c=J(),this.v=1,yt.call(this,t,n)}return t.prototype.push=function(t,n){yt.prototype.push.call(this,t,n)},t.prototype.p=function(t,n){this.c.p(t);var r=K(t,this.o,this.v&&2,n&&4,!n);this.v&&(dt(r,this.o),this.v=0),n&&ht(r,r.length-4,this.c.d()),this.ondata(r,n)},t}();_e.Zlib=Ft;var Et=function(){return function(t,n){at([X,tt,function(){return[ot,yt,Ft]}],this,wt.call(this,t,n),(function(t){var n=new Ft(t.data);onmessage=ot(n)}),10)}}();function Gt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[X,tt,function(){return[Pt]}],(function(t){return rt(Pt(t.data[0],t.data[1]))}),4,r)}function Pt(t,n){n||(n={});var r=J();r.p(t);var e=K(t,n,2,4);return dt(e,n),ht(e,e.length-4,r.d()),e}_e.AsyncZlib=Et,_e.zlib=Gt,_e.zlibSync=Pt;var jt=function(){function t(t){this.v=1,zt.call(this,t)}return t.prototype.push=function(t,n){if(zt.prototype.e.call(this,t),this.v){if(this.p.length<2&&!n)return;this.p=this.p.subarray(2),this.v=0}if(n){if(this.p.length<4)throw"invalid zlib stream";this.p=this.p.subarray(0,-4)}zt.prototype.c.call(this,n)},t}();_e.Unzlib=jt;var qt=function(){return function(t){this.ondata=t,at([W,nt,function(){return[ot,zt,jt]}],this,0,(function(){var t=new jt;onmessage=ot(t)}),11)}}();function Ht(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return it(t,n,[W,nt,function(){return[Yt]}],(function(t){return rt(Yt(t.data[0],et(t.data[1])))}),5,r)}function Yt(t,n){return U((gt(t),t.subarray(2,-4)),n)}_e.AsyncUnzlib=qt,_e.unzlib=Ht,_e.unzlibSync=Yt;var Bt=function(){function t(t){this.G=Ot,this.I=zt,this.Z=jt,this.ondata=t}return t.prototype.push=function(t,r){if(!this.ondata)throw"no stream handler";if(this.s)this.s.push(t,r);else{if(this.p&&this.p.length){var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length)}else this.p=t;if(this.p.length>2){var i=this,o=function(){i.ondata.apply(i,arguments)};this.s=31==this.p[0]&&139==this.p[1]&&8==this.p[2]?new this.G(o):8!=(15&this.p[0])||this.p[0]>>4>7||(this.p[0]<<8|this.p[1])%31?new this.I(o):new this.Z(o),this.s.push(this.p,r),this.p=null}}},t}();_e.Decompress=Bt;var Jt=function(){function t(t){this.G=Tt,this.I=kt,this.Z=qt,this.ondata=t}return t.prototype.push=function(t,n){Bt.prototype.push.call(this,t,n)},t}();function Kt(t,n,r){if(r||(r=n,n={}),"function"!=typeof r)throw"no callback";return 31==t[0]&&139==t[1]&&8==t[2]?Zt(t,n,r):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?Mt(t,n,r):Ht(t,n,r)}function Lt(t,n){return 31==t[0]&&139==t[1]&&8==t[2]?It(t,n):8!=(15&t[0])||t[0]>>4>7||(t[0]<<8|t[1])%31?At(t,n):Yt(t,n)}_e.AsyncDecompress=Jt,_e.decompress=Kt,_e.decompressSync=Lt;var Nt=function(t,r,e,i){for(var o in t){var a=t[o],s=r+o;a instanceof n?e[s]=[a,i]:Array.isArray(a)?e[s]=[a[0],L(i,a[1])]:Nt(a,s+"/",e,i)}},Qt="undefined"!=typeof TextEncoder&&new TextEncoder,Rt="undefined"!=typeof TextDecoder&&new TextDecoder,Vt=0;try{Rt.decode(q,{stream:!0}),Vt=1}catch(t){}var Wt=function(t){for(var n="",r=0;;){var e=t[r++],i=(e>127)+(e>223)+(e>239);if(r+i>t.length)return[n,C(t,r-1)];i?3==i?(e=((15&e)<<18|(63&t[r++])<<12|(63&t[r++])<<6|63&t[r++])-65536,n+=String.fromCharCode(55296|e>>10,56320|1023&e)):n+=String.fromCharCode(1&i?(31&e)<<6|63&t[r++]:(15&e)<<12|(63&t[r++])<<6|63&t[r++]):n+=String.fromCharCode(e)}},Xt=function(){function t(t){this.ondata=t,Vt?this.t=new TextDecoder:this.p=q}return t.prototype.push=function(t,r){if(!this.ondata)throw"no callback";if(r=!!r,this.t){if(this.ondata(this.t.decode(t,{stream:!0}),r),r){if(this.t.decode().length)throw"invalid utf-8 data";this.t=null}}else{if(!this.p)throw"stream finished";var e=new n(this.p.length+t.length);e.set(this.p),e.set(t,this.p.length);var i=Wt(e),o=i[0],a=i[1];if(r){if(a.length)throw"invalid utf-8 data";this.p=null}else this.p=a;this.ondata(o,r)}},t}();_e.DecodeUTF8=Xt;var $t=function(){function t(t){this.ondata=t}return t.prototype.push=function(t,n){if(!this.ondata)throw"no callback";if(this.d)throw"stream finished";this.ondata(_t(t),this.d=n||!1)},t}();function _t(t,r){if(r){for(var e=new n(t.length),i=0;i<t.length;++i)e[i]=t.charCodeAt(i);return e}if(Qt)return Qt.encode(t);var o=t.length,a=new n(t.length+(t.length>>1)),s=0,f=function(t){a[s++]=t};for(i=0;i<o;++i){if(s+5>a.length){var u=new n(s+8+(o-i<<1));u.set(a),a=u}var h=t.charCodeAt(i);h<128||r?f(h):h<2048?(f(192|h>>6),f(128|63&h)):h>55295&&h<57344?(f(240|(h=65536+(1047552&h)|1023&t.charCodeAt(++i))>>18),f(128|h>>12&63),f(128|h>>6&63),f(128|63&h)):(f(224|h>>12),f(128|h>>6&63),f(128|63&h))}return C(a,0,s)}function tn(t,n){if(n){for(var r="",e=0;e<t.length;e+=16384)r+=String.fromCharCode.apply(null,t.subarray(e,e+16384));return r}if(Rt)return Rt.decode(t);var i=Wt(t);if(i[1].length)throw"invalid utf-8 data";return i[0]}_e.EncodeUTF8=$t,_e.strToU8=_t,_e.strFromU8=tn;var nn=function(t){return 1==t?3:t<6?2:9==t?1:0},rn=function(t,n){return n+30+st(t,n+26)+st(t,n+28)},en=function(t,n,r){var e=st(t,n+28),i=tn(t.subarray(n+46,n+46+e),!(2048&st(t,n+8))),o=n+46+e,a=ft(t,n+20),s=r&&4294967295==a?on(t,o):[a,ft(t,n+24),ft(t,n+42)],f=s[0],u=s[1],h=s[2];return[st(t,n+10),f,u,i,o+st(t,n+30)+st(t,n+32),h]},on=function(t,n){for(;1!=st(t,n);n+=4+st(t,n+2));return[ut(t,n+12),ut(t,n+4),ut(t,n+20)]},an=function(t){var n=0;if(t)for(var r in t){var e=t[r].length;if(e>65535)throw"extra field too long";n+=e+4}return n},sn=function(t,n,r,e,i,o,a,s){var f=e.length,u=r.extra,h=s&&s.length,c=an(u);ht(t,n,null!=a?33639248:67324752),n+=4,null!=a&&(t[n++]=20,t[n++]=r.os),t[n]=20,n+=2,t[n++]=r.flag<<1|(null==o&&8),t[n++]=i&&8,t[n++]=255&r.compression,t[n++]=r.compression>>8;var l=new Date(null==r.mtime?Date.now():r.mtime),p=l.getFullYear()-1980;if(p<0||p>119)throw"date not in range 1980-2099";if(ht(t,n,p<<25|l.getMonth()+1<<21|l.getDate()<<16|l.getHours()<<11|l.getMinutes()<<5|l.getSeconds()>>>1),n+=4,null!=o&&(ht(t,n,r.crc),ht(t,n+4,o),ht(t,n+8,r.size)),ht(t,n+12,f),ht(t,n+14,c),n+=16,null!=a&&(ht(t,n,h),ht(t,n+6,r.attrs),ht(t,n+10,a),n+=14),t.set(e,n),n+=f,c)for(var v in u){var d=u[v],g=d.length;ht(t,n,+v),ht(t,n+2,g),t.set(d,n+4),n+=4+g}return h&&(t.set(s,n),n+=h),n},fn=function(t,n,r,e,i){ht(t,n,101010256),ht(t,n+8,r),ht(t,n+10,r),ht(t,n+12,e),ht(t,n+16,i)},un=function(){function t(t){this.filename=t,this.c=B(),this.size=0,this.compression=0}return t.prototype.process=function(t,n){this.ondata(null,t,n)},t.prototype.push=function(t,n){if(!this.ondata)throw"no callback - add to ZIP archive before pushing";this.c.p(t),this.size+=t.length,n&&(this.crc=this.c.d()),this.process(t,n||!1)},t}();_e.ZipPassThrough=un;var hn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new yt(n,(function(t,n){r.ondata(null,t,n)})),this.compression=8,this.flag=nn(n.level)}return t.prototype.process=function(t,n){try{this.d.push(t,n)}catch(t){this.ondata(t,null,n)}},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.ZipDeflate=hn;var cn=function(){function t(t,n){var r=this;n||(n={}),un.call(this,t),this.d=new mt(n,(function(t,n,e){r.ondata(t,n,e)})),this.compression=8,this.flag=nn(n.level),this.terminate=this.d.terminate}return t.prototype.process=function(t,n){this.d.push(t,n)},t.prototype.push=function(t,n){un.prototype.push.call(this,t,n)},t}();_e.AsyncZipDeflate=cn;var ln=function(){function t(t){this.ondata=t,this.u=[],this.d=1}return t.prototype.add=function(t){var r=this;if(2&this.d)throw"stream finished";var e=_t(t.filename),i=e.length,o=t.comment,a=o&&_t(o),s=i!=t.filename.length||a&&o.length!=a.length,f=i+an(t.extra)+30;if(i>65535)throw"filename too long";var u=new n(f);sn(u,0,t,e,s);var h=[u],c=function(){for(var t=0,n=h;t<n.length;t++)r.ondata(null,n[t],!1);h=[]},l=this.d;this.d=0;var p=this.u.length,v=L(t,{f:e,u:s,o:a,t:function(){t.terminate&&t.terminate()},r:function(){if(c(),l){var t=r.u[p+1];t?t.r():r.d=1}l=1}}),d=0;t.ondata=function(e,i,o){if(e)r.ondata(e,i,o),r.terminate();else if(d+=i.length,h.push(i),o){var a=new n(16);ht(a,0,134695760),ht(a,4,t.crc),ht(a,8,d),ht(a,12,t.size),h.push(a),v.c=d,v.b=f+d+16,v.crc=t.crc,v.size=t.size,l&&v.r(),l=1}else l&&c()},this.u.push(v)},t.prototype.end=function(){var t=this;if(2&this.d){if(1&this.d)throw"stream finishing";throw"stream finished"}this.d?this.e():this.u.push({r:function(){1&t.d&&(t.u.splice(-1,1),t.e())},t:function(){}}),this.d=3},t.prototype.e=function(){for(var t=0,r=0,e=0,i=0,o=this.u;i<o.length;i++)e+=46+(u=o[i]).f.length+an(u.extra)+(u.o?u.o.length:0);for(var a=new n(e+22),s=0,f=this.u;s<f.length;s++){var u;sn(a,t,u=f[s],u.f,u.u,u.c,r,u.o),t+=46+u.f.length+an(u.extra)+(u.o?u.o.length:0),r+=u.b}fn(a,t,this.u.length,e,r),this.ondata(null,a,!0),this.d=2},t.prototype.terminate=function(){for(var t=0,n=this.u;t<n.length;t++)n[t].t();this.d=2},t}();function pn(t,r,e){if(e||(e=r,r={}),"function"!=typeof e)throw"no callback";var i={};Nt(t,"",i,r);var o=Object.keys(i),a=o.length,s=0,f=0,u=a,h=Array(a),c=[],l=function(){for(var t=0;t<c.length;++t)c[t]()},p=function(){var t=new n(f+22),r=s,i=f-s;f=0;for(var o=0;o<u;++o){var a=h[o];try{var c=a.c.length;sn(t,f,a,a.f,a.u,c);var l=30+a.f.length+an(a.extra),p=f+l;t.set(a.c,p),sn(t,s,a,a.f,a.u,c,f,a.m),s+=16+l+(a.m?a.m.length:0),f=p+c}catch(t){return e(t,null)}}fn(t,s,h.length,i,r),e(null,t)};a||p();for(var v=function(t){var n=o[t],r=i[n],u=r[0],v=r[1],d=B(),g=u.length;d.p(u);var w=_t(n),y=w.length,m=v.comment,b=m&&_t(m),x=b&&b.length,z=an(v.extra),k=0==v.level?0:8,M=function(r,i){if(r)l(),e(r,null);else{var o=i.length;h[t]=L(v,{size:g,crc:d.d(),c:i,f:w,m:b,u:y!=n.length||b&&m.length!=x,compression:k}),s+=30+y+z+o,f+=76+2*(y+z)+(x||0)+o,--a||p()}};if(y>65535&&M("filename too long",null),k)if(g<16e4)try{M(null,xt(u,v))}catch(t){M(t,null)}else c.push(bt(u,v,M));else M(null,u)},d=0;d<u;++d)v(d);return l}function vn(t,r){r||(r={});var e={},i=[];Nt(t,"",e,r);var o=0,a=0;for(var s in e){var f=e[s],u=f[0],h=f[1],c=0==h.level?0:8,l=(M=_t(s)).length,p=h.comment,v=p&&_t(p),d=v&&v.length,g=an(h.extra);if(l>65535)throw"filename too long";var w=c?xt(u,h):u,y=w.length,m=B();m.p(u),i.push(L(h,{size:u.length,crc:m.d(),c:w,f:M,m:v,u:l!=s.length||v&&p.length!=d,o:o,compression:c})),o+=30+l+g+y,a+=76+2*(l+g)+(d||0)+y}for(var b=new n(a+22),x=o,z=a-o,k=0;k<i.length;++k){var M;sn(b,(M=i[k]).o,M,M.f,M.u,M.c.length);var A=30+M.f.length+an(M.extra);b.set(M.c,M.o+A),sn(b,o,M,M.f,M.u,M.c.length,M.o,M.m),o+=16+A+(M.m?M.m.length:0)}return fn(b,o,i.length,z,x),b}_e.Zip=ln,_e.zip=pn,_e.zipSync=vn;var dn=function(){function t(){}return t.prototype.push=function(t,n){this.ondata(null,t,n)},t.compression=0,t}();_e.UnzipPassThrough=dn;var gn=function(){function t(){var t=this;this.i=new zt((function(n,r){t.ondata(null,n,r)}))}return t.prototype.push=function(t,n){try{this.i.push(t,n)}catch(r){this.ondata(r,t,n)}},t.compression=8,t}();_e.UnzipInflate=gn;var wn=function(){function t(t,n){var r=this;n<32e4?this.i=new zt((function(t,n){r.ondata(null,t,n)})):(this.i=new kt((function(t,n,e){r.ondata(t,n,e)})),this.terminate=this.i.terminate)}return t.prototype.push=function(t,n){this.i.terminate&&(t=C(t,0)),this.i.push(t,n)},t.compression=8,t}();_e.AsyncUnzipInflate=wn;var yn=function(){function t(t){this.onfile=t,this.k=[],this.o={0:dn},this.p=q}return t.prototype.push=function(t,r){var e=this;if(!this.onfile)throw"no callback";if(!this.p)throw"stream finished";if(this.c>0){var i=Math.min(this.c,t.length),o=t.subarray(0,i);if(this.c-=i,this.d?this.d.push(o,!this.c):this.k[0].push(o),(t=t.subarray(i)).length)return this.push(t,r)}else{var a=0,s=0,f=void 0,u=void 0;this.p.length?t.length?((u=new n(this.p.length+t.length)).set(this.p),u.set(t,this.p.length)):u=this.p:u=t;for(var h=u.length,c=this.c,l=c&&this.d,p=function(){var t,n=ft(u,s);if(67324752==n){a=1,f=s,v.d=null,v.c=0;var r=st(u,s+6),i=st(u,s+8),o=2048&r,l=8&r,p=st(u,s+26),d=st(u,s+28);if(h>s+30+p+d){var g=[];v.k.unshift(g),a=2;var w,y=ft(u,s+18),m=ft(u,s+22),b=tn(u.subarray(s+30,s+=30+p),!o);4294967295==y?(t=l?[-2]:on(u,s),y=t[0],m=t[1]):l&&(y=-1),s+=d,v.c=y;var x={name:b,compression:i,start:function(){if(!x.ondata)throw"no callback";if(y){var t=e.o[i];if(!t)throw"unknown compression type "+i;(w=y<0?new t(b):new t(b,y,m)).ondata=function(t,n,r){x.ondata(t,n,r)};for(var n=0,r=g;n<r.length;n++)w.push(r[n],!1);e.k[0]==g&&e.c?e.d=w:w.push(q,!0)}else x.ondata(null,q,!0)},terminate:function(){w&&w.terminate&&w.terminate()}};y>=0&&(x.size=y,x.originalSize=m),v.onfile(x)}return"break"}if(c){if(134695760==n)return f=s+=12+(-2==c&&8),a=3,v.c=0,"break";if(33639248==n)return f=s-=4,a=3,v.c=0,"break"}},v=this;s<h-4&&"break"!==p();++s);if(this.p=q,c<0){var d=u.subarray(0,a?f-12-(-2==c&&8)-(134695760==ft(u,f-16)&&4):s);l?l.push(d,!!a):this.k[+(2==a)].push(d)}if(2&a)return this.push(u.subarray(s),r);this.p=u.subarray(s)}if(r){if(this.c)throw"invalid zip file";this.p=null}},t.prototype.register=function(t){this.o[t.compression]=t},t}();function mn(t,r){if("function"!=typeof r)throw"no callback";for(var e=[],i=function(){for(var t=0;t<e.length;++t)e[t]()},o={},a=t.length-22;101010256!=ft(t,a);--a)if(!a||t.length-a>65558)return void r("invalid zip file",null);var s=st(t,a+8);s||r(null,{});var f=s,u=ft(t,a+16),h=4294967295==u;if(h){if(a=ft(t,a-12),101075792!=ft(t,a))return void r("invalid zip file",null);f=s=ft(t,a+32),u=ft(t,a+48)}for(var c=function(a){var f=en(t,u,h),c=f[0],l=f[1],p=f[2],v=f[3],d=f[4],g=rn(t,f[5]);u=d;var w=function(t,n){t?(i(),r(t,null)):(o[v]=n,--s||r(null,o))};if(c)if(8==c){var y=t.subarray(g,g+l);if(l<32e4)try{w(null,At(y,new n(p)))}catch(t){w(t,null)}else e.push(Mt(y,{size:p},w))}else w("unknown compression type "+c,null);else w(null,C(t,g,g+l))},l=0;l<f;++l)c();return i}function bn(t){for(var r={},e=t.length-22;101010256!=ft(t,e);--e)if(!e||t.length-e>65558)throw"invalid zip file";var i=st(t,e+8);if(!i)return{};var o=ft(t,e+16),a=4294967295==o;if(a){if(e=ft(t,e-12),101075792!=ft(t,e))throw"invalid zip file";i=ft(t,e+32),o=ft(t,e+48)}for(var s=0;s<i;++s){var f=en(t,o,a),u=f[0],h=f[1],c=f[2],l=f[3],p=f[4],v=rn(t,f[5]);if(o=p,u){if(8!=u)throw"unknown compression type "+u;r[l]=At(t.subarray(v,v+h),new n(c))}else r[l]=C(t,v,v+h)}return r}_e.Unzip=yn,_e.unzip=mn,_e.unzipSync=bn;return _e})

