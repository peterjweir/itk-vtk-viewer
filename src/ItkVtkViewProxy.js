import macro from 'vtk.js/Sources/macro';

import vtkViewProxy from 'vtk.js/Sources/Proxy/Core/ViewProxy';
import vtkPointPicker from 'vtk.js/Sources/Rendering/Core/PointPicker';
import vtkActor from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkCubeSource from 'vtk.js/Sources/Filters/Sources/CubeSource';
import vtkMapper from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkCoordinate from 'vtk.js/Sources/Rendering/Core/Coordinate';
import vtkInteractiveOrientationWidget from 'vtk.js/Sources/Widgets/Widgets3D/InteractiveOrientationWidget';
import vtkWidgetManager from 'vtk.js/Sources/Widgets/Core/WidgetManager';
import * as vtkMath from 'vtk.js/Sources/Common/Core/Math';

const CursorCornerAnnotation =
  '<table style="margin-left: 0;"><tr><td style="margin-left: auto; margin-right: 0;">Index:</td><td>${iIndex},</td><td>${jIndex},</td><td>${kIndex}</td></tr><tr><td style="margin-left: auto; margin-right: 0;">Position:</td><td>${xPosition},</td><td>${yPosition},</td><td>${zPosition}</td></tr><tr><td style="margin-left: auto; margin-right: 0;"">Value:</td><td>${value}</td></tr></table>';

const { vtkErrorMacro } = macro;

// ----------------------------------------------------------------------------
// ItkVtkViewProxy methods
// ----------------------------------------------------------------------------

function ItkVtkViewProxy(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('ItkVtkViewProxy');

  // Private --------------------------------------------------------------------
  //
  function setVisualizationMode(axisIndex) {
    // volume rendering
    if (axisIndex === -1) {
      model.interactor.setInteractorStyle(model.interactorStyle3D);
      if (model.rotate && !!!model.rotateAnimationCallback) {
        model.rotateAnimationCallback = model.interactor.onAnimation(
          rotateAzimuth
        );
        model.interactor.requestAnimation('itk-vtk-view-rotate');
      }
      if (model.volumeRenderingCameraState) {
        model.camera.setFocalPoint(
          ...model.volumeRenderingCameraState.focalPoint
        );
        model.camera.setPosition(...model.volumeRenderingCameraState.position);
        model.camera.setViewUp(...model.volumeRenderingCameraState.viewUp);
        model.camera.setViewAngle(model.volumeRenderingCameraState.viewAngle);
        model.camera.setParallelScale(
          model.volumeRenderingCameraState.parallelScale
        );
        model.camera.setPhysicalTranslation(
          ...model.volumeRenderingCameraState.physicalTranslation
        );
      }
      model.camera.setParallelProjection(false);
      if (model.volumeRepresentation) {
        if (model.viewPlanes) {
          publicAPI.setCornerAnnotation('se', CursorCornerAnnotation);
        } else {
          publicAPI.setCornerAnnotation('se', '');
        }
        model.volumeRepresentation.setSliceVisibility(model.viewPlanes);
        model.volumeRepresentation.setVolumeVisibility(true);
      }
    } else {
      model.camera.setParallelProjection(true);
      publicAPI.setCornerAnnotation('se', CursorCornerAnnotation);
      model.interactor.setInteractorStyle(model.interactorStyle2D);
      if (model.rotate && !!model.rotateAnimationCallback) {
        model.interactor.cancelAnimation('itk-vtk-view-rotate');
        model.rotateAnimationCallback.unsubscribe();
        model.rotateAnimationCallback = null;
      }
      if (model.volumeRepresentation) {
        model.volumeRepresentation.setVolumeVisibility(false);
        model.volumeRepresentation.getActors().forEach((actor, index) => {
          if (index === axisIndex) {
            actor.setVisibility(true);
          } else {
            actor.setVisibility(false);
          }
        });
      }
      switch (axisIndex) {
        case 0:
          publicAPI.updateOrientation(0, 1, [0, 0, 1]);
          break;
        case 1:
          publicAPI.updateOrientation(1, -1, [0, 0, 1]);
          break;
        case 2:
          publicAPI.updateOrientation(2, -1, [0, -1, 0]);
          break;
        default:
          vtkErrorMacro('Unexpected view mode');
      }
    }
  }

  function updateAnnotations(callData) {
    const renderPosition = callData.position;
    model.annotationPicker.pick(
      [renderPosition.x, renderPosition.y, 0.0],
      callData.pokedRenderer
    );
    const ijk = model.annotationPicker.getPointIJK();
    if (model.volumeRepresentation) {
      const imageData = model.volumeRepresentation.getInputDataSet();
      const size = imageData.getDimensions();
      const scalarData = imageData.getPointData().getScalars();
      const value = scalarData.getTuple(
        size[0] * size[1] * ijk[2] + size[0] * ijk[1] + ijk[0]
      );
      const worldPositions = model.annotationPicker.getPickedPositions();
      if (ijk.length > 0 && worldPositions.length > 0) {
        const worldPosition = worldPositions[0];
        model.dataProbeCubeSource.setCenter(worldPosition);
        model.dataProbeActor.setVisibility(true);
        model.dataProbeFrameActor.setVisibility(true);
        publicAPI.updateCornerAnnotation({
          iIndex: ijk[0],
          jIndex: ijk[1],
          kIndex: ijk[2],
          xPosition: String(worldPosition[0]).substring(0, 4),
          yPosition: String(worldPosition[1]).substring(0, 4),
          zPosition: String(worldPosition[2]).substring(0, 4),
          value: value,
        });
      } else {
        model.dataProbeActor.setVisibility(false);
        model.dataProbeFrameActor.setVisibility(false);
      }
    }
  }

  function majorAxis(vec3, idxA, idxB) {
    const axis = [0, 0, 0];
    const idx = Math.abs(vec3[idxA]) > Math.abs(vec3[idxB]) ? idxA : idxB;
    const value = vec3[idx] > 0 ? 1 : -1;
    axis[idx] = value;
    return axis;
  }

  // Setup --------------------------------------------------------------------

  publicAPI.setCornerAnnotation('se', '');
  publicAPI.updateCornerAnnotation({
    iIndex: '&nbsp;N/A',
    jIndex: '&nbsp;N/A',
    kIndex: '&nbsp;N/A',
    xPosition: '&nbsp;N/A',
    yPosition: '&nbsp;N/A',
    zPosition: '&nbsp;N/A',
    value: 'N/A&nbsp;',
  });
  publicAPI.setAnnotationOpacity(0.0);
  model.annotationPicker = vtkPointPicker.newInstance();
  model.annotationPicker.setPickFromList(1);
  model.annotationPicker.initializePickList();
  model.interactor.onMouseMove((event) => {
    updateAnnotations(event);
  });
  model.interactor.onStartMouseMove((event) => {
    if (model.viewMode !== 'VolumeRendering' || model.viewPlanes) {
      publicAPI.getInteractor().requestAnimation('annotationMouseMove');
    }
  });
  model.interactor.onEndMouseMove((event) => {
    if (model.viewMode !== 'VolumeRendering' || model.viewPlanes) {
      publicAPI.getInteractor().cancelAnimation('annotationMouseMove');
    }
  });
  model.interactor.onEndMouseWheel((event) => {
    updateDataProbeSize();
  });

  // use the same color map in the planes
  // colormap changes with window / level
  // window / level changes piecewise =jk

  model.dataProbeCubeSource = vtkCubeSource.newInstance();
  model.dataProbeMapper = vtkMapper.newInstance();
  model.dataProbeMapper.setInputConnection(
    model.dataProbeCubeSource.getOutputPort()
  );
  model.dataProbeActor = vtkActor.newInstance();
  model.dataProbeActor.setMapper(model.dataProbeMapper);
  model.dataProbeFrameActor = vtkActor.newInstance();
  model.dataProbeFrameActor.setMapper(model.dataProbeMapper);
  model.renderer.addActor(model.dataProbeActor);
  const dataProbeProperty = model.dataProbeActor.getProperty();
  dataProbeProperty.setLighting(false);
  dataProbeProperty.setColor(1.0, 1.0, 1.0);
  const dataProbeFrameProperty = model.dataProbeFrameActor.getProperty();
  dataProbeFrameProperty.setRepresentation(1);
  dataProbeFrameProperty.setColor(0.0, 0.0, 0.0);
  model.renderer.addActor(model.dataProbeFrameActor);
  model.dataProbeActor.setVisibility(false);
  model.dataProbeFrameActor.setVisibility(false);

  function updateDataProbeSize() {
    if (model.volumeRepresentation) {
      const image = model.volumeRepresentation.getInputDataSet();
      const spacing = image.getSpacing();
      let viewableScale = null;
      if (model.camera.getParallelProjection()) {
        viewableScale = model.camera.getParallelScale() / 40;
      } else {
        const distance = model.camera.getDistance();
        // Heuristic assuming a constant view angle
        viewableScale = distance / 150;
      }
      model.dataProbeCubeSource.setXLength(Math.max(spacing[0], viewableScale));
      model.dataProbeCubeSource.setYLength(Math.max(spacing[1], viewableScale));
      model.dataProbeCubeSource.setZLength(Math.max(spacing[2], viewableScale));
    }
  }

  model.camera.pitch(-30.0);
  model.camera.azimuth(30.0);

  model.widgetManager = null;
  model.orientationWidget.setViewportSize(0.1);
  const superRenderLater = publicAPI.renderLater;
  publicAPI.renderLater = () => {
    superRenderLater();
    updateScaleBar();
    let have2DImage = false;
    const imageData = model.volumeRepresentation.getInputDataSet();
    if (!!imageData) {
      const size = imageData.getDimensions();
      if (size[2] < 2) {
        have2DImage = true;
      }
    }
    if (!!!model.widgetManager && !have2DImage) {
      setTimeout(() => {
        model.widgetManager = vtkWidgetManager.newInstance();
        model.widgetManager.setRenderer(model.orientationWidget.getRenderer());
        const widget = vtkInteractiveOrientationWidget.newInstance();
        widget.placeWidget(model.orientationAxesArrow.getBounds());
        widget.setBounds(model.orientationAxesArrow.getBounds());
        widget.setPlaceFactor(1);
        model.interactiveOrientationWidget = widget;

        const vw = model.widgetManager.addWidget(widget);

        //// Manage user interaction
        //vw.onOrientationChange(({ up, direction, action, event }) => {
          //const focalPoint = model.camera.getFocalPoint();
          //const position = model.camera.getPosition();
          //const viewUp = model.camera.getViewUp();

          //const distance = Math.sqrt(
            //vtkMath.distance2BetweenPoints(position, focalPoint)
          //);
          //model.camera.setPosition(
            //focalPoint[0] + direction[0] * distance,
            //focalPoint[1] + direction[1] * distance,
            //focalPoint[2] + direction[2] * distance
          //);

          //if (direction[0]) {
            //model.camera.setViewUp(majorAxis(viewUp, 1, 2));
          //}
          //if (direction[1]) {
            //model.camera.setViewUp(majorAxis(viewUp, 0, 2));
          //}
          //if (direction[2]) {
            //model.camera.setViewUp(majorAxis(viewUp, 0, 1));
          //}

          //model.orientationWidget.updateMarkerOrientation();
          //model.widgetManager.enablePicking();
          //model.renderWindow.render();
        //});
        //model.widgetManager.enablePicking();
      }, 0);
    }
  };

  model.scaleBarCanvas = document.createElement('canvas');
  model.scaleBarCanvas.style.position = 'absolute';
  model.scaleBarCanvas.style.left = '50%';
  model.scaleBarCanvas.style.bottom = '5.0%';
  model.scaleBarCanvas.style.width = '100px';
  model.scaleBarCanvas.style.height = '30px';
  model.scaleBarCanvas.width = 100 * window.devicePixelRatio;
  model.scaleBarCanvas.height = 30 * window.devicePixelRatio;
  model.scaleBarCenterCoord = vtkCoordinate.newInstance();
  model.scaleBarCenterCoord.setRenderer(model.renderer);
  model.scaleBarCenterCoord.setCoordinateSystemToNormalizedViewport();
  model.scaleBarCenterCoord.setValue(0.5, 0.5)
  model.scaleBarCoordWidth = vtkCoordinate.newInstance();
  model.scaleBarCoordWidth.setReferenceCoordinate(model.scaleBarCenterCoord);
  model.scaleBarCoordWidth.setCoordinateSystemToViewport();
  model.scaleBarCoordWidth.setRenderer(model.renderer);
  model.scaleBarCoordWidth.setValue(model.scaleBarCanvas.width, 0);
  function updateScaleBar() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const scaleBarCtx = model.scaleBarCanvas.getContext('2d');

    const dims = { width: model.scaleBarCanvas.clientWidth * devicePixelRatio,
      height: model.scaleBarCanvas.clientHeight * devicePixelRatio
    };

    scaleBarCtx.clearRect(0, 0, dims.width, dims.height);
    scaleBarCtx.fillStyle = model.cornerAnnotation.getAnnotationContainer().style.color;

    scaleBarCtx.fillRect(0,
      (dims.height*0.85).toFixed(),
      dims.width,
      4 * devicePixelRatio);

    scaleBarCtx.font = `${16 * devicePixelRatio}px serif`;
    scaleBarCtx.textAlign = 'center';
    scaleBarCtx.textBaseline = 'bottom';
    model.scaleBarCoordWidth.setValue(dims.width, 0);
    const cw = model.scaleBarCoordWidth.getComputedWorldValue();
    const cc = model.scaleBarCenterCoord.getComputedWorldValue();
    const length = Math.sqrt((cw[0] - cc[0]) * (cw[0] - cc[0]) +
      (cw[1] - cc[1]) * (cw[1] - cc[1]),
      (cw[2] - cc[2]) * (cw[2] - cc[2]));
    scaleBarCtx.fillText(`${Number.parseFloat(length).toPrecision(1)}`, dims.width*0.5, dims.height*0.65, dims.width*0.9);
  }
  model.interactor.onEndMouseWheel(updateScaleBar);
  model.interactor.onEndPinch(updateScaleBar);

  // API ----------------------------------------------------------------------

  publicAPI.setViewMode = (mode) => {
    if (model.viewMode === 'VolumeRendering') {
      model.volumeRenderingCameraState = model.camera.getState();
    }
    switch (mode) {
      case 'XPlane':
        if (model.viewMode === 'XPlane') {
          break;
        }
        model.viewMode = mode;
        setVisualizationMode(0);
        break;
      case 'YPlane':
        if (model.viewMode === 'YPlane') {
          break;
        }
        model.viewMode = mode;
        setVisualizationMode(1);
        break;
      case 'ZPlane':
        if (model.viewMode === 'ZPlane') {
          break;
        }
        model.viewMode = mode;
        setVisualizationMode(2);
        break;
      case 'VolumeRendering':
        if (model.viewMode === 'VolumeRendering') {
          break;
        }
        model.viewMode = mode;
        setVisualizationMode(-1);
        break;
      default:
        vtkErrorMacro('Unexpected view mode');
    }
    publicAPI.resetCamera();
    updateDataProbeSize();
  };

  publicAPI.setViewPlanes = (viewPlanes) => {
    model.viewPlanes = viewPlanes;
    if (model.viewMode === 'VolumeRendering' && model.volumeRepresentation) {
      model.volumeRepresentation.setSliceVisibility(viewPlanes);
      if (viewPlanes) {
        publicAPI.setCornerAnnotation('se', CursorCornerAnnotation);
      }
      model.renderWindow.render();
    }
  };

  publicAPI.setOrientationAnnotationVisibility = (visible) => {
    if (visible) {
      model.scaleBarCanvas.style.display = 'block';
      if (model.volumeRepresentation) {
        publicAPI.setAnnotationOpacity(1.0);
        model.orientationWidget.setEnabled(true);
        model.renderWindow.render();
      }
    } else {
      model.scaleBarCanvas.style.display = 'none';
      publicAPI.setAnnotationOpacity(0.0);
      model.orientationWidget.setEnabled(false);
      model.renderWindow.render();
    }
  };

  publicAPI.setPlanesUseLinearInterpolation = (interpolate) => {
    if (model.volumeRepresentation) {
      if (interpolate) {
        model.volumeRepresentation.getActors().forEach((actor) => {
          actor.getProperty().setInterpolationTypeToLinear();
          actor
            .getProperty()
            .getRGBTransferFunction()
            .modified();
        });
        model.renderWindow.render();
      } else {
        model.volumeRepresentation.getActors().forEach((actor) => {
          actor.getProperty().setInterpolationTypeToNearest();
          actor
            .getProperty()
            .getRGBTransferFunction()
            .modified();
        });
        model.renderWindow.render();
      }
    }
  };

  const superAddRepresentation = publicAPI.addRepresentation;
  publicAPI.addRepresentation = (representation) => {
    superAddRepresentation(representation);

    if (!representation) {
      return;
    }

    const volumeRepresentations = model.representations.filter((rep) => {
      const isVolumeRepresentation = !!rep.getVolumes().length;
      return isVolumeRepresentation;
    });
    if (volumeRepresentations[0]) {
      model.volumeRepresentation = volumeRepresentations[0];
      const volume = model.volumeRepresentation.getVolumes()[0];
      const property = volume.getProperty();
      property.setAmbient(0.4);
      property.setDiffuse(1.0);
      property.setSpecular(0.4);
      property.setSpecularPower(25);
      model.volumeRepresentation
        .getActors()
        .forEach(model.annotationPicker.addPickList);
      updateDataProbeSize();
      publicAPI.setAnnotationOpacity(1.0);
    }
  };

  const superRemoveRepresentation = publicAPI.removeRepresentation;
  publicAPI.removeRepresentation = (representation) => {
    superRemoveRepresentation(representation);

    if (!representation) {
      return;
    }
    representation.getActors().forEach(model.annotationPicker.deletePickList);
  };

  // Continuously rotate in 3D
  function rotateAzimuth() {
    model.renderer.getActiveCamera().azimuth(0.25);
    model.renderer.resetCameraClippingRange();
  }
  model.rotateAnimationCallback = null;
  publicAPI.setRotate = (rotate) => {
    if (model.rotate === rotate) {
      return;
    }
    model.rotate = rotate;

    if (rotate) {
      model.rotateAnimationCallback = model.interactor.onAnimation(
        rotateAzimuth
      );
      model.interactor.requestAnimation('itk-vtk-view-rotate');
    } else {
      model.interactor.cancelAnimation('itk-vtk-view-rotate');
      if (!!model.rotateAnimationCallback) {
        model.rotateAnimationCallback.unsubscribe();
        model.rotateAnimationCallback = null;
      }
    }
  };

  const superSetContainer = publicAPI.setContainer;
  publicAPI.setContainer = (container) => {
    superSetContainer(container);
    if (container) {
      container.appendChild(model.scaleBarCanvas);
    }
  }

  const superResize = publicAPI.resize;
  publicAPI.resize = () => {
    if (model.container) {
      const dims = model.container.getBoundingClientRect();
      if (dims.width === dims.height && dims.width === 0) {
        return;
      }
      const devicePixelRatio = window.devicePixelRatio || 1;
      const width = Math.max(10, Math.floor(devicePixelRatio * dims.width));
      const height = Math.max(10, Math.floor(devicePixelRatio * dims.height));
      model.openglRenderWindow.setSize(width, height);

      model.scaleBarCanvas.width = (100 * devicePixelRatio).toFixed();
      model.scaleBarCanvas.height = (30 * devicePixelRatio).toFixed();

      publicAPI.invokeResize({ width, height });
      publicAPI.renderLater();
    }
  }
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  viewMode: 'VolumeRendering',
  viewPlanes: false,
  rotate: false,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  vtkViewProxy.extend(publicAPI, model, initialValues);
  macro.get(publicAPI, model, ['viewMode', 'viewPlanes', 'rotate']);

  // Object specific methods
  ItkVtkViewProxy(publicAPI, model);
}
// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend, 'ItkVtkViewProxy');

// ----------------------------------------------------------------------------

export default { newInstance, extend };
