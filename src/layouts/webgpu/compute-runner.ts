/**
 * WebGPU Compute Runner for Force-Directed Layout
 * Handles parallelized N-Body repulsion calculations.
 */

import layoutShader from './layout.wgsl?raw';

export interface LayoutParams {
    nodeCount: number;
    deltaTime: number;
    viscosity: number;
    repulsionStrength: number;
    gravityStrength: number;
    centerX: number;
    centerY: number;
}

export class WebGPULayoutRunner {
    private device: GPUDevice | null = null;
    private pipeline: GPUComputePipeline | null = null;
    private nodeBuffer: GPUBuffer | null = null;
    private paramsBuffer: GPUBuffer | null = null;
    private bindGroup: GPUBindGroup | null = null;
    private stagingBuffer: GPUBuffer | null = null;

    async init() {
        if (!navigator.gpu) {
            throw new Error('WebGPU not supported on this browser.');
        }

        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
            throw new Error('No appropriate GPU adapter found.');
        }

        this.device = await adapter.requestDevice();

        const shaderModule = this.device.createShaderModule({
            code: layoutShader,
        });

        this.pipeline = await this.device.createComputePipelineAsync({
            layout: 'auto',
            compute: {
                module: shaderModule,
                entryPoint: 'main',
            },
        });
    }

    setupBuffers(initialNodes: Float32Array) {
        if (!this.device || !this.pipeline) return;

        const bufferSize = initialNodes.byteLength;

        // 1. Node Storage Buffer
        this.nodeBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
            mappedAtCreation: true,
        });
        new Float32Array(this.nodeBuffer.getMappedRange()).set(initialNodes);
        this.nodeBuffer.unmap();

        // 2. Staging Buffer
        this.stagingBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
        });

        // 3. Params Uniform Buffer
        this.paramsBuffer = this.device.createBuffer({
            size: 32,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.bindGroup = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.nodeBuffer } },
                { binding: 1, resource: { buffer: this.paramsBuffer } },
            ],
        });
    }

    updateParams(params: LayoutParams) {
        if (!this.device || !this.paramsBuffer) return;

        const paramsArray = new Float32Array([
            params.nodeCount,
            params.deltaTime,
            params.viscosity,
            params.repulsionStrength,
            params.gravityStrength,
            params.centerX,
            params.centerY,
            0.0, // padding
        ]);

        this.device.queue.writeBuffer(this.paramsBuffer, 0, paramsArray);
    }

    async step(nodeCount: number): Promise<Float32Array> {
        if (!this.device || !this.pipeline || !this.bindGroup || !this.nodeBuffer || !this.stagingBuffer) {
            throw new Error('WebGPU runner not initialized.');
        }

        const commandEncoder = this.device.createCommandEncoder();
        const passEncoder = commandEncoder.beginComputePass();
        passEncoder.setPipeline(this.pipeline);
        passEncoder.setBindGroup(0, this.bindGroup);
        
        const workgroupCount = Math.ceil(nodeCount / 256);
        passEncoder.dispatchWorkgroups(workgroupCount);
        passEncoder.end();

        commandEncoder.copyBufferToBuffer(
            this.nodeBuffer, 0, 
            this.stagingBuffer, 0, 
            this.nodeBuffer.size
        );

        this.device.queue.submit([commandEncoder.finish()]);

        await this.stagingBuffer.mapAsync(GPUMapMode.READ);
        const results = new Float32Array(this.stagingBuffer.getMappedRange().slice(0));
        this.stagingBuffer.unmap();

        return results;
    }

    destroy() {
        this.nodeBuffer?.destroy();
        this.paramsBuffer?.destroy();
        this.stagingBuffer?.destroy();
        this.device?.destroy();
    }
}
