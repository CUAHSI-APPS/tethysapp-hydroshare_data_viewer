var SLD_TEMPLATES = {};

(function() {

    this.getComponentSLD = function(layerType, layerRef, layerComponent, componentSymbology) {
        if (layerType === 'line') {
            if (layerComponent === 'stroke') {
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
                                            '<Rule>' +
                                                '<LineSymbolizer>' +
                                                    '<Stroke>' +
                                                        '<CssParameter name="stroke">#000000</CssParameter>' +
                                                        '<CssParameter name="stroke-width">' + componentSymbology['size'] + '</CssParameter>' +
                                                        '<CssParameter name="stroke-linecap">round</CssParameter>' +
                                                        '<CssParameter name="stroke-linejoin">round</CssParameter>' +
                                                    '</Stroke>' +
                                                '</LineSymbolizer>' +
                                            '</Rule>' +
                                        '</FeatureTypeStyle>' +
                                    '</UserStyle>' +
                                '</NamedLayer>' +
                            '</StyledLayerDescriptor>';
            };
            if (layerComponent === 'label') {
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
                                            '<Rule>' +
                                                '<TextSymbolizer>' +
                                                    '<Label>' + 
                                                        '<ogc:PropertyName>' + componentSymbology['fontAttr'] + '</ogc:PropertyName>' +
                                                    '</Label>' +
                                                    '<Font>' +
                                                        '<CssParameter name="font-family">' + componentSymbology['fontFamily'] + '</CssParameter>' +
                                                        '<CssParameter name="font-size">' + componentSymbology['fontSize'] + '</CssParameter>' +
                                                    '</Font>' +
                                                    '<Fill>' +
                                                        '<CssParameter name="fill">#00000</CssParameter>' +
                                                    '</Fill>' +
                                                '</TextSymbolizer>' +
                                            '</Rule>' +
                                        '</FeatureTypeStyle>' +
                                    '</UserStyle>' +
                                '</NamedLayer>' +
                            '</StyledLayerDescriptor>';
            };
        };
        if (layerType === 'polygon') {
            if (layerComponent === 'fill') {
                var sldString = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
                            '<StyledLayerDescriptor version="1.0.0" ' +
                            'xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd" ' +
                            'xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" ' +
                            'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                                '<NamedLayer>' +
                                    '<Name>' + layerRef + '</Name>' +
                                    '<UserStyle>' +
                                        '<FeatureTypeStyle>' +
                                            '<Rule>' +
                                                '<PolygonSymbolizer>' +
                                                    '<Fill>' +
                                                        '<CssParameter name="fill">#FFFFFF</CssParameter>' +
                                                    '</Fill>' +
                                                '</PolygonSymbolizer>' +
                                            '</Rule>' +
                                        '</FeatureTypeStyle>' +
                                    '</UserStyle>' +
                                '</NamedLayer>' +
                            '</StyledLayerDescriptor>';
            };
            if (layerComponent === 'stroke') {
                var sldString = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
                            '<StyledLayerDescriptor version="1.0.0" ' +
                            'xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd" ' +
                            'xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" ' +
                            'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                                '<NamedLayer>' +
                                    '<Name>' + layerRef + '</Name>' +
                                    '<UserStyle>' +
                                        '<FeatureTypeStyle>' +
                                            '<Rule>' +
                                                '<PolygonSymbolizer>' +
                                                    '<Stroke>' +
                                                        '<CssParameter name="stroke">#FF0000</CssParameter>' +
                                                        '<CssParameter name="stroke-width">' + componentSymbology['size'] + '</CssParameter>' +
                                                        '<CssParameter name="stroke-linecap">round</CssParameter>' +
                                                        '<CssParameter name="stroke-linejoin">round</CssParameter>' +
                                                    '</Stroke>' +
                                                '</PolygonSymbolizer>' +
                                            '</Rule>' +
                                        '</FeatureTypeStyle>' +
                                    '</UserStyle>' +
                                '</NamedLayer>' +
                            '</StyledLayerDescriptor>';
            };
            if (layerComponent === 'label') {
                var sldString = '<?xml version="1.0" encoding="ISO-8859-1"?>' +
                            '<StyledLayerDescriptor version="1.0.0" ' +
                            'xsi:schemaLocation="http://www.opengis.net/sld http://schemas.opengis.net/sld/1.0.0/StyledLayerDescriptor.xsd" ' +
                            'xmlns="http://www.opengis.net/sld" xmlns:ogc="http://www.opengis.net/ogc" ' +
                            'xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
                                '<NamedLayer>' +
                                    '<Name>' + layerRef + '</Name>' +
                                    '<UserStyle>' +
                                        '<FeatureTypeStyle>' +
                                            '<Rule>' +
                                                '<TextSymbolizer>' +
                                                    '<Label>' + 
                                                        '<ogc:PropertyName>' + componentSymbology['fontAttr'] + '</ogc:PropertyName>' +
                                                    '</Label>' +
                                                    '<Font>' +
                                                        '<CssParameter name="font-family">' + componentSymbology['fontAttr'] + '</CssParameter>' +
                                                        '<CssParameter name="font-size">' + componentSymbology['fontSize'] + '</CssParameter>' +
                                                    '</Font>' +
                                                    '<Fill>' +
                                                        '<CssParameter name="fill">#000000</CssParameter>' +
                                                    '</Fill>' +
                                                '</TextSymbolizer>' +
                                            '</Rule>' +
                                        '</FeatureTypeStyle>' +
                                    '</UserStyle>' +
                                '</NamedLayer>' +
                            '</StyledLayerDescriptor>';
            };
        };
        if (layerType === 'raster') {
            var sldString = null;
        };
        return sldString;
    };

}).apply(SLD_TEMPLATES);
