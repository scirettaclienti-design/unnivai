import React from 'react';
import GoogleMapContainer from './map/GoogleMapContainer';

export default function ExploreMiniMap(props) {
    return <GoogleMapContainer {...props} defaultZoom={11} />;
}
