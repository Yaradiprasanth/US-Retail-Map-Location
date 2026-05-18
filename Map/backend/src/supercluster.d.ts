declare module "supercluster" {
  export type BBox = [number, number, number, number];

  export interface ClusterFeature<P> {
    type: "Feature";
    properties: P & { point_count?: number };
    geometry: { type: "Point"; coordinates: [number, number] };
  }

  export default class Supercluster<P = Record<string, unknown>> {
    constructor(options?: { radius?: number; maxZoom?: number });
    load(features: ClusterFeature<P>[]): this;
    getClusters(bbox: BBox, zoom: number): ClusterFeature<P>[];
    getClusterExpansionZoom(clusterId: number): number;
  }
}
