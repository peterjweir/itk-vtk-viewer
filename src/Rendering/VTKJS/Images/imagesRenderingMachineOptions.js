import createImageRenderer from './createImageRenderer'
import toggleLayerVisibility from './toggleLayerVisibility'
import toggleLayerBBox from './toggleLayerBBox'
import applyComponentVisibility from './applyComponentVisibility'
import updateRenderedImage from './updateRenderedImage'
import updateHistogram from './updateHistogram'
import selectImageLayer from './selectImageLayer'
import toggleInterpolation from './toggleInterpolation'
import applyColorRange from './applyColorRange'
import { applyColorRangeBounds } from './applyColorRangeBounds'
import applyColorMap from './applyColorMap'
import applyRenderedImage from './applyRenderedImage'
import assignRenderedImage from './assignRenderedImage'
import applyPiecewiseFunction from './applyPiecewiseFunction'
import applyShadow from './applyShadow'
import applyGradientOpacity from './applyGradientOpacity'
import applyVolumeSampleDistance from './applyVolumeSampleDistance'
import applyBlendMode from './applyBlendMode'
import applyLookupTable from './applyLookupTable'
import applyLabelImageBlend from './applyLabelImageBlend'
import applyLabelNames from './applyLabelNames'
import applyLabelImageWeights from './applyLabelImageWeights'
import applySelectedLabel from './applySelectedLabel'
import mapToPiecewiseFunctionNodes from './mapToPiecewiseFunctionNodes'
import { getBoundsOfFullImage } from '../Main/croppingPlanes'
import { computeRenderedBounds } from '../Main/computeRenderedBounds'
import { applyCinematicChanged } from './applyCinematicChanged'
import assignVisualizedComponents from './assignVisualizedComponents'

const EPSILON = 0.000001

const areBoundsBiggerThanLoaded = context => {
  const {
    images: { actorContext },
    actorName,
  } = context
  const { loadedBounds } = actorContext.get(actorName)
  if (!loadedBounds) return true

  const fullImage = getBoundsOfFullImage(context)
  const current = computeRenderedBounds(context)
  // clamp rendered bounds to max size of image
  current.forEach((b, i) => {
    current[i] =
      i % 2
        ? Math.min(b, fullImage[i]) // high bound case
        : Math.max(b, fullImage[i]) // low bound case
  })

  return loadedBounds.some((loaded, i) => {
    return i % 2
      ? current[i] - loaded > EPSILON // high bound case: currentBounds[i] > loadedBound
      : loaded - current[i] > EPSILON // low bound case: currentBounds[i] < loadedBound
  })
}

const isTargetScaleLoaded = context => {
  const {
    images: { actorContext },
    targetScale,
    actorName,
  } = context
  const { loadedScale } = actorContext.get(actorName)
  return loadedScale === targetScale
}

const imagesRenderingMachineOptions = {
  imageRenderingActor: {
    services: {
      createImageRenderer,
      updateRenderedImage,
      updateHistogram,
    },

    actions: {
      applyRenderedImage,
      assignRenderedImage,
      assignVisualizedComponents,

      toggleLayerVisibility,

      applyComponentVisibility,

      applyPiecewiseFunction,
      applyColorRange,
      applyColorRangeBounds,
      applyColorMap,
      mapToPiecewiseFunctionNodes,

      toggleInterpolation,
      applyShadow,
      applyGradientOpacity,
      applyVolumeSampleDistance,
      applyBlendMode,

      applyLookupTable,
      applyLabelImageBlend,
      applyLabelNames,
      applyLabelImageWeights,
      applySelectedLabel,
      applyCinematicChanged,

      toggleLayerBBox,
    },

    guards: {
      isFramerateScalePickingOn: ({ images, actorName }) =>
        images.actorContext.get(actorName).isFramerateScalePickingOn,

      isImageUpdateNeeded: context =>
        context.isUpdateForced ||
        (context.images.selectedName === context.actorName && // only update if rendering (aka selected)
          (!isTargetScaleLoaded(context) ||
            areBoundsBiggerThanLoaded(context))),
    },
  },

  actions: {
    selectImageLayer,
  },
}

export default imagesRenderingMachineOptions
