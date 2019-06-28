var SLD_TEMPLATES = {};

(function() {

    this.getLayerSLD = function(layerType, layerRef, layerSymbology) {
        switch (layerType) {
            case 'timeseries':
                switch (layerSymbology['type']) {
                    case 'simple':
                        switch (layerSymbology['shape']) {
                            case 'circle':
                                var vectorStyle = new ol.style.Style({
                                    'image': new ol.style.Circle({
                                        'radius': layerSymbology['size'],
                                        'fill': new ol.style.Fill({
                                            'color': layerSymbology['fillColor']
                                        }),
                                        'stroke': new ol.style.Stroke({
                                            'color': layerSymbology['strokeColor'],
                                            'width': layerSymbology['strokeWidth']
                                        })
                                    })
                                });
                                break;
                            case 'triangle':
                                var vectorStyle = new ol.style.Style({

                                });
                                break;
                            case 'square':
                                var vectorStyle = new ol.style.Style({

                                });
                                break;
                        };
                        return vectorStyle;
                };
                break;
            case 'point':
                switch (layerSymbology['type']) {
                    case 'simple':
                        var rule = '<Rule>' +
                            '<PointSymbolizer>' +
                                '<Graphic>' +
                                    '<Mark>' +
                                        '<WellKnownName>' +
                                            layerSymbology['shape'] +
                                        '</WellKnownName>' +
                                        '<Fill>' +
                                            '<CssParameter name="fill">' +
                                                layerSymbology['fillColor'] +
                                            '</CssParameter>' +
                                            '<CssParameter name="fill-opacity">' +
                                                layerSymbology['fillOpacity'] +
                                            '</CssParameter>' +
                                        '</Fill>' +
                                        '<Stroke>' +
                                            '<CssParameter name="stroke">' +
                                                layerSymbology['strokeColor'] +
                                            '</CssParameter>' +
                                            '<CssParameter name="stroke-opacity">' +
                                                layerSymbology['strokeOpacity'] +
                                            '</CssParameter>' + 
                                            '<CssParameter name="stroke-width">' +
                                                layerSymbology['strokeWidth'] +
                                            '</CssParameter>' + 
                                        '</Stroke>' +
                                    '</Mark>' +
                                    '<Size>' +
                                        layerSymbology['size'] +
                                    '</Size>' +
                                '</Graphic>' +
                            '</PointSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'colormap':
                        var rule = '';
                        break;
                    case 'colorbreak':
                        var rule = '';
                        break;
                    case 'size':
                        var rule = '';
                        break;
                };
                break;
            case 'line':
                switch (layerSymbology['type']) {
                    case 'simple':
                        var rule = '<Rule>' +
                            '<LineSymbolizer>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        layerSymbology['strokeColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-opacity">' +
                                        layerSymbology['strokeOpacity'] +
                                    '</CssParameter>' + 
                                    '<CssParameter name="stroke-width">' +
                                        layerSymbology['strokeWidth'] +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</LineSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'colormap':
                        var rule = '';
                        break;
                    case 'colorbreak':
                        var rule = '';
                        break;
                    case 'size':
                        var rule = '';
                        break;
                };
                break;
            case 'polygon':
                switch (layerSymbology['type']) {
                    case 'simple':
                        var rule = '<Rule>' +
                            '<PolygonSymbolizer>' +
                                '<Fill>' +
                                    '<CssParameter name="fill">' +
                                        layerSymbology['fillColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="fill-opacity">' +
                                        layerSymbology['fillOpacity'] +
                                    '</CssParameter>' +
                                '</Fill>' +
                                '<Stroke>' +
                                    '<CssParameter name="stroke">' +
                                        layerSymbology['strokeColor'] +
                                    '</CssParameter>' +
                                    '<CssParameter name="stroke-opacity">' +
                                        layerSymbology['strokeOpacity'] +
                                    '</CssParameter>' + 
                                    '<CssParameter name="stroke-width">' +
                                        layerSymbology['strokeWidth'] +
                                    '</CssParameter>' + 
                                '</Stroke>' +
                            '</PolygonSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'colormap':
                        var rule = '';
                        break;
                    case 'colorbreak':
                        var rule = '';
                        break
                };
                break;
            case 'raster':
                switch (layerSymbology['type']) {
                    case 'colormap':
                        var colormap = '';
                        for (var i = 0; i < layerSymbology['colormap']['positions'].length; i++) {
                            colormap = colormap + '<ColorMapEntry color="' + layerSymbology['colormap']['colors'][i] + '" quantity="' + layerSymbology['colormap']['positions'][i] + '" />';
                        };
                        var rule = '<Rule>' +
                            '<RasterSymbolizer>' +
                                '<ColorMap>' +
                                    colormap +
                                '</ColorMap>' +
                            '</RasterSymbolizer>' +
                        '</Rule>';
                        break;
                    case 'colorbreak':
                        var rule = '';
                        break;
                };
                break;
        };
        var sldString = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
            '<StyledLayerDescriptor version="1.0.0" ' +
            'xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd" ' +
            'xmlns="http://www.opengis.net/sld" ' +
            'xmlns:ogc="http://www.opengis.net/ogc" ' +
            'xmlns:xlink="http://www.w3.org/1999/xlink" ' +
            'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                '<NamedLayer>' +
                    '<Name>' + layerRef + '</Name>' +
                    '<UserStyle>' +
                        '<FeatureTypeStyle>' +
                        rule +
                        '</FeatureTypeStyle>' +
                    '</UserStyle>' +
                '</NamedLayer>' +
            '</StyledLayerDescriptor>';
        return sldString;
    };

}).apply(SLD_TEMPLATES);
