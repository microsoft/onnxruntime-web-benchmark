function createModel(tf) {
    var tfModel = tf.sequential();
    tfModel.add(tf.layers.conv2d({
        inputShape: [224,224,1],
        kernelSize: [5,5],
        padding: 'same',
        filters: 64,
        strides: 1,
        activation: 'relu',
        useBias: true,
        biasInitializer: 'ones',
        kernelInitializer: 'varianceScaling'
    }));
    tfModel.add(tf.layers.conv2d({
        kernelSize: 3,
        padding: 'same',
        filters: 64,
        strides: 1,
        activation: 'relu',
        useBias: true,
        biasInitializer: 'ones',
        kernelInitializer: 'varianceScaling'
    }));
    tfModel.add(tf.layers.conv2d({
        kernelSize: 3,
        padding: 'same',
        filters: 32,
        strides: 1,
        activation: 'relu',
        useBias: true,
        biasInitializer: 'ones',
        kernelInitializer: 'varianceScaling'
    }));
    tfModel.add(tf.layers.conv2d({
        kernelSize: 3,
        padding: 'same',
        filters: 9,
        strides: 1,
        activation: 'relu',
        useBias: true,
        biasInitializer: 'ones',
        kernelInitializer: 'varianceScaling'
    }));
    tfModel.add(tf.layers.reshape({targetShape: [1,3,3,224,224]}))
    tfModel.add(tf.layers.permute({dims: [1, 4, 2, 5, 3]}));
    tfModel.add(tf.layers.reshape({targetShape: [1,672,672]}));
    return tfModel;
}