// Last time updated at June 14, 2014, 08:32:23

//------------------------------------
/*
-. breaking updates:
-. now, you MUST always set config-type == 'video' for Firefox; otherwise
-. RecordRTC will record audio/ogg instead of video/webm.
-. It doesn't matter which kind of stream you're passing. Multi-tracks or single track.
*/

// issues?
// -. (fixed) audio recording while passing multi-tracks media stream for Firefox.
// -. audio self-playback (ehco/noise/etc.)
// -. need to fix: recordRTC.setAdvertisementArray( [ 'data:image-webp', 'data:image-webp', 'data:image-webp' ] );
// -. it seems that RecordRTC is cutting off the last couple of seconds of recordings
// -. ffmpeg-asm.js demos should encode in Hight Quality audio and video containers (ref issue #204)
// -. 14K ogg is not a good output; it should be 128k ogg. VLC is unable to play it; it must!
//------------------------------------

// Browsers Support::
// Chrome (all versions) [ audio/video individually ]
// Firefox ( >= 29 ) [ audio/video in single webm/mp4 container or only audio in ogg ]
// Opera (all versions) [ same as chrome ]
// Android (Chrome) [ only video ]
// Android (Opera) [ only video ]
// Android (Firefox) [ only video ]

//------------------------------------
// Muaz Khan         - www.MuazKhan.com
// MIT License       - www.WebRTC-Experiment.com/licence
// Documentation     - github.com/muaz-khan/WebRTC-Experiment/tree/master/RecordRTC
//------------------------------------
// Note: RecordRTC.js is using 3 other libraries; you need to accept their licences as well.
//------------------------------------
// 1. RecordRTC.js
// 2. MRecordRTC.js
// 3. Cross-Browser-Declarations.js
// 4. Storage.js
// 5. MediaStreamRecorder.js
// 6. StereoRecorder.js
// 7. StereoAudioRecorder.js
// 8. CanvasRecorder.js
// 9. WhammyRecorder.js
// 10. Whammy.js
// 11. DiskStorage.js
// 12. GifRecorder.js
// 13. gifEncoder.js
//------------------------------------

// ____________
// RecordRTC.js

function RecordRTC(mediaStream, config) {
    config = config || {};

    if (!mediaStream) throw 'MediaStream is mandatory.';
    if (!config.type) config.type = 'audio';

    function startRecording() {
        console.debug('started recording ' + config.type + ' stream.');

        // Media Stream Recording API has not been implemented in chrome yet;
        // That's why using WebAudio API to record stereo audio in WAV format
        var Recorder = IsChrome ? window.StereoRecorder : window.MediaStreamRecorder;

        // video recorder (in WebM format)
        if (config.type == 'video' && IsChrome) Recorder = window.WhammyRecorder;

        // video recorder (in Gif format)
        if (config.type == 'gif') Recorder = window.GifRecorder;

        // html2canvas recording!
        if (config.type == 'canvas') Recorder = window.CanvasRecorder;

        mediaRecorder = new Recorder(mediaStream);

        // Merge all data-types except "function"
        mediaRecorder = mergeProps(mediaRecorder, config);
        mediaRecorder.onAudioProcessStarted = function () {
            if (config.onAudioProcessStarted) config.onAudioProcessStarted();
        };

        mediaRecorder.record();

        return this;
    }

    function stopRecording(callback) {
        if (!mediaRecorder) return console.warn(WARNING);

        console.warn('stopped recording ' + config.type + ' stream.');

        if ((config.type == 'audio') || (config.type == 'video') || (config.type == 'canvas')) {
            mediaRecorder.stop(_callback);
        } else {
            mediaRecorder.stop();
            _callback();
        }

        function _callback() {
            var blob = mediaRecorder.recordedBlob;
            if (callback) {
                var url = URL.createObjectURL(blob);
                callback(url);
            }
            console.debug(blob.type, '->', bytesToSize(blob.size));

            if (config.autoWriteToDisk) {
                getDataURL(function (dataURL) {
                    var parameter = {};
                    parameter[config.type + 'Blob'] = dataURL;
                    DiskStorage.Store(parameter);
                });
            }
        }
    }

    function getDataURL(callback, _mediaRecorder) {
        if (!callback) throw 'Pass a callback function over getDataURL.';

        _getDataURL();

        function _getDataURL() {
            if (!!window.Worker) {
                var webWorker = processInWebWorker(function readFile(_blob) {
                    postMessage(new FileReaderSync().readAsDataURL(_blob));
                });

                webWorker.onmessage = function (event) {
                    callback(event.data);
                };

                webWorker.postMessage(_mediaRecorder ? _mediaRecorder.recordedBlob : mediaRecorder.recordedBlob);
            } else {
                var reader = new FileReader();
                reader.readAsDataURL(_mediaRecorder ? _mediaRecorder.recordedBlob : mediaRecorder.recordedBlob);
                reader.onload = function (event) {
                    callback(event.target.result);
                };
            }
        }

        function processInWebWorker(_function) {
            var blob = URL.createObjectURL(new Blob([_function.toString(),
                'this.onmessage =  function (e) {readFile(e.data);}'
            ], {
                type: 'application/javascript'
            }));

            var worker = new Worker(blob);
            URL.revokeObjectURL(blob);
            return worker;
        }
    }

    var WARNING = 'It seems that "startRecording" is not invoked for ' + config.type + ' recorder.';

    var mediaRecorder;

    return {
        startRecording: startRecording,
        stopRecording: stopRecording,
        getBlob: function () {
            if (!mediaRecorder) return console.warn(WARNING);
            return mediaRecorder.recordedBlob;
        },
        getDataURL: getDataURL,
        toURL: function () {
            if (!mediaRecorder) return console.warn(WARNING);
            return URL.createObjectURL(mediaRecorder.recordedBlob);
        },
        save: function () {
            if (!mediaRecorder) return console.warn(WARNING);

            // bug: should we use "getBlob" instead; to handle aww-snaps!
            this.getDataURL(function (dataURL) {
                var hyperlink = document.createElement('a');
                hyperlink.href = dataURL;
                hyperlink.target = '_blank';
                hyperlink.download = (Math.round(Math.random() * 9999999999) + 888888888) + '.' + mediaRecorder.recordedBlob.type.split('/')[1];

                var evt = new MouseEvent('click', {
                    view: window,
                    bubbles: true,
                    cancelable: true
                });

                hyperlink.dispatchEvent(evt);

                (window.URL || window.webkitURL).revokeObjectURL(hyperlink.href);
            });
        },
        getFromDisk: function (callback) {
            if (!mediaRecorder) return console.warn(WARNING);
            RecordRTC.getFromDisk(config.type, callback);
        },
        setAdvertisementArray: function (arrayOfWebPImages) {
            this.advertisement = [];

            var length = arrayOfWebPImages.length;
            for (var i = 0; i < length; i++) {
                this.advertisement.push({
                    duration: i,
                    image: arrayOfWebPImages[i]
                });
            }
        }
    };
}

RecordRTC.getFromDisk = function (type, callback) {
    if (!callback) throw 'callback is mandatory.';

    console.log('Getting recorded ' + (type == 'all' ? 'blobs' : type + ' blob ') + ' from disk!');
    DiskStorage.Fetch(function (dataURL, _type) {
        if (type != 'all' && _type == type + 'Blob') {
            if (callback) callback(dataURL);
        }

        if (type == 'all') {
            if (callback) callback(dataURL, _type.replace('Blob', ''));
        }
    });
};

RecordRTC.writeToDisk = function (options) {
    console.log('Writing recorded blob(s) to disk!');
    options = options || {};
    if (options.audio && options.video && options.gif) {
        options.audio.getDataURL(function (audioDataURL) {
            options.video.getDataURL(function (videoDataURL) {
                options.gif.getDataURL(function (gifDataURL) {
                    DiskStorage.Store({
                        audioBlob: audioDataURL,
                        videoBlob: videoDataURL,
                        gifBlob: gifDataURL
                    });
                });
            });
        });
    } else if (options.audio && options.video) {
        options.audio.getDataURL(function (audioDataURL) {
            options.video.getDataURL(function (videoDataURL) {
                DiskStorage.Store({
                    audioBlob: audioDataURL,
                    videoBlob: videoDataURL
                });
            });
        });
    } else if (options.audio && options.gif) {
        options.audio.getDataURL(function (audioDataURL) {
            options.gif.getDataURL(function (gifDataURL) {
                DiskStorage.Store({
                    audioBlob: audioDataURL,
                    gifBlob: gifDataURL
                });
            });
        });
    } else if (options.video && options.gif) {
        options.video.getDataURL(function (videoDataURL) {
            options.gif.getDataURL(function (gifDataURL) {
                DiskStorage.Store({
                    videoBlob: videoDataURL,
                    gifBlob: gifDataURL
                });
            });
        });
    } else if (options.audio) {
        options.audio.getDataURL(function (audioDataURL) {
            DiskStorage.Store({
                audioBlob: audioDataURL
            });
        });
    } else if (options.video) {
        options.video.getDataURL(function (videoDataURL) {
            DiskStorage.Store({
                videoBlob: videoDataURL
            });
        });
    } else if (options.gif) {
        options.gif.getDataURL(function (gifDataURL) {
            DiskStorage.Store({
                gifBlob: gifDataURL
            });
        });
    }
};

// _____________________________
// Cross-Browser-Declarations.js

// animation-frame used in WebM recording
if (!window.requestAnimationFrame) {
    requestAnimationFrame = window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame;
}

if (!window.cancelAnimationFrame) {
    cancelAnimationFrame = window.webkitCancelAnimationFrame || window.mozCancelAnimationFrame;
}

// WebAudio API representer
if (!window.AudioContext) {
    window.AudioContext = window.webkitAudioContext || window.mozAudioContext;
}

URL = window.URL || window.webkitURL;
navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;

if (window.webkitMediaStream) window.MediaStream = window.webkitMediaStream;

IsChrome = !!navigator.webkitGetUserMedia;

// Merge all other data-types except "function"

function mergeProps(mergein, mergeto) {
    mergeto = reformatProps(mergeto);
    for (var t in mergeto) {
        if (typeof mergeto[t] !== 'function') {
            mergein[t] = mergeto[t];
        }
    }
    return mergein;
}

function reformatProps(obj) {
    var output = {};
    for (var o in obj) {
        if (o.indexOf('-') != -1) {
            var splitted = o.split('-');
            var name = splitted[0] + splitted[1].split('')[0].toUpperCase() + splitted[1].substr(1);
            output[name] = obj[o];
        } else output[o] = obj[o];
    }
    return output;
}

// __________ (used to handle stuff like http://goo.gl/xmE5eg) issue #129
// Storage.js
var Storage = {
    AudioContext: window.AudioContext || window.webkitAudioContext
};

// ______________________
// MediaStreamRecorder.js

// todo: need to show alert boxes for incompatible cases
// encoder only supports 48k/16k mono audio channel

/**
 * Implementation of https://dvcs.w3.org/hg/dap/raw-file/default/media-stream-capture/MediaRecorder.html
 * The MediaRecorder accepts a mediaStream as input source passed from UA. When recorder starts,
 * a MediaEncoder will be created and accept the mediaStream as input source.
 * Encoder will get the raw data by track data changes, encode it by selected MIME Type, then store the encoded in EncodedBufferCache object.
 * The encoded data will be extracted on every timeslice passed from Start function call or by RequestData function.
 * Thread model:
 * When the recorder starts, it creates a "Media Encoder" thread to read data from MediaEncoder object and store buffer in EncodedBufferCache object.
 * Also extract the encoded data and create blobs on every timeslice passed from start function or RequestData function called by UA.
 */

function MediaStreamRecorder(mediaStream) {
    var self = this;

    // if user chosen only audio option; and he tried to pass MediaStream with
    // both audio and video tracks;
    // using a dirty workaround to generate audio-only stream so that we can get audio/ogg output.
    if (this.type == 'audio' && mediaStream.getVideoTracks && mediaStream.getVideoTracks().length) {
        var context = new AudioContext();
        var mediaStreamSource = context.createMediaStreamSource(mediaStream);

        var destination = context.createMediaStreamDestination();
        mediaStreamSource.connect(destination);

        mediaStream = destination.stream;
    }

    var dataAvailable = false;
    this.record = function () {
        // http://dxr.mozilla.org/mozilla-central/source/content/media/MediaRecorder.cpp
        // https://wiki.mozilla.org/Gecko:MediaRecorder
        // https://dvcs.w3.org/hg/dap/raw-file/default/media-stream-capture/MediaRecorder.html

        // starting a recording session; which will initiate "Reading Thread"
        // "Reading Thread" are used to prevent main-thread blocking scenarios
        mediaRecorder = new MediaRecorder(mediaStream);

        // Dispatching OnDataAvailable Handler
        mediaRecorder.ondataavailable = function (e) {
            if (dataAvailable) return;

            if (!e.data.size) {
                console.warn('Recording of', e.data.type, 'failed.');
                return;
            }

            // todo: need to check who commented following two lines and why?
            // pull #118
            // if (self.recordedBlob) self.recordedBlob = new Blob([self.recordedBlob, e.data], { type: e.data.type || 'audio/ogg' });

            dataAvailable = true;
            self.recordedBlob = new Blob([e.data], {
                type: e.data.type || 'audio/ogg'
            });
            self.callback();
        };

        mediaRecorder.onerror = function (error) {
            console.warn(error);
            mediaRecorder.stop();
            self.record(0);
        };

        // void start(optional long mTimeSlice)
        // The interval of passing encoded data from EncodedBufferCache to onDataAvailable
        // handler. "mTimeSlice < 0" means Session object does not push encoded data to
        // onDataAvailable, instead, it passive wait the client side pull encoded data
        // by calling requestData API.
        mediaRecorder.start(0);

        // Start recording. If timeSlice has been provided, mediaRecorder will
        // raise a dataavailable event containing the Blob of collected data on every timeSlice milliseconds.
        // If timeSlice isn't provided, UA should call the RequestData to obtain the Blob data, also set the mTimeSlice to zero.

        if (self.onAudioProcessStarted) self.onAudioProcessStarted();
    };

    this.stop = function (callback) {
        this.callback = callback;
        // mediaRecorder.state == 'recording' means that media recorder is associated with "session"
        // mediaRecorder.state == 'stopped' means that media recorder is detached from the "session" ... in this case; "session" will also be deleted.

        if (mediaRecorder.state == 'recording') {
            mediaRecorder.requestData();
            mediaRecorder.stop();
        }
    };

    // Reference to "MediaRecorder" object
    var mediaRecorder;
}

// _________________
// StereoRecorder.js

function StereoRecorder(mediaStream) {
    this.record = function () {
        mediaRecorder = new StereoAudioRecorder(mediaStream, this);

        var self = this;
        mediaRecorder.onAudioProcessStarted = function () {
            if (self.onAudioProcessStarted) self.onAudioProcessStarted();
        };

        mediaRecorder.record();
    };

    this.stop = function (callback) {
        var self = this;
        if (mediaRecorder)
            mediaRecorder.stop(function () {
                self.recordedBlob = mediaRecorder.recordedBlob;
                callback();
            });
    };

    // Reference to "StereoAudioRecorder" object
    var mediaRecorder;
}

// source code from: http://typedarray.org/wp-content/projects/WebAudioRecorder/script.js
// https://github.com/mattdiamond/Recorderjs#license-mit
// ______________________
// StereoAudioRecorder.js

// In Chrome, when the javascript node is out of scope, the onaudioprocess callback stops firing. 
// This leads to audio being significantly shorter than the generated video.
var __stereoAudioRecorderJavacriptNode;

// A shimmed stereo recorder that actually records in mono
function StereoAudioRecorder(mediaStream, root) {
    // variables
    var leftchannel = [];
    var rightchannel = [];
    var recording = false;
    var recordingLength = 0;

    this.record = function () {
        // reset the buffers for the new recording
        leftchannel.length = rightchannel.length = 0;
        recordingLength = 0;

        recording = true;
    };

    this.stop = function (callback) {
        setTimeout(onRecordingStopped, 1000);

        function onRecordingStopped() {
            // stop recording
            recording = false;

            // flat the left and right channels down
            var leftBuffer = mergeBuffers(leftchannel, recordingLength);

            // create our wav file
            var buffer = new ArrayBuffer(44 + leftBuffer.length * 2);
            var view = new DataView(buffer);

            // RIFF chunk descriptor
            writeUTFBytes(view, 0, 'RIFF');
            view.setUint32(4, 44 + leftBuffer.length * 2, true);
            writeUTFBytes(view, 8, 'WAVE');

            // FMT sub-chunk
            writeUTFBytes(view, 12, 'fmt ');
            view.setUint32(16, 16, true);
            view.setUint16(20, 1, true);

            // stereo (2 channels)
            // view.setUint16(22, 2, true);
            // view.setUint32(24, sampleRate, true);
            // view.setUint32(28, sampleRate * 4, true);
            // view.setUint16(32, 4, true);
            // view.setUint16(34, 16, true);
            view.setUint16(22, 1, true); // NumChannels
            view.setUint32(24, sampleRate, true); // SampleRate
            view.setUint32(28, sampleRate * 2, true); // ByteRate == SampleRate * NumChannels * BitsPerSample/8
            view.setUint16(32, 2, true); // BlockAlign
            view.setUint16(34, 16, true); // BitsPerSample

            // data sub-chunk
            writeUTFBytes(view, 36, 'data');
            view.setUint32(40, leftBuffer.length * 2, true);

            // write the PCM samples
            var lng = leftBuffer.length;
            var index = 44;
            volume = 1;
            for (var i = 0; i < lng; i++) {
                view.setInt16(index, leftBuffer[i] * (0x7FFF * volume), true);
                index += 2;
            }

            // final binary blob
            self.recordedBlob = new Blob([view], {
                type: 'audio/wav'
            });

            // recorded audio length
            self.length = recordingLength;

            callback();

            isAudioProcessStarted = false;
        }

        var self = this;
    };

    function interleave(leftChannel, rightChannel) {
        var length = leftChannel.length + rightChannel.length;
        var result = new Float32Array(length);

        var inputIndex = 0;

        for (var index = 0; index < length;) {
            result[index++] = leftChannel[inputIndex];
            result[index++] = rightChannel[inputIndex];
            inputIndex++;
        }
        return result;
    }

    function mergeBuffers(channelBuffer, rLength) {
        var result = new Float32Array(rLength);
        var offset = 0;
        var lng = channelBuffer.length;
        for (var i = 0; i < lng; i++) {
            var buffer = channelBuffer[i];
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    }

    function writeUTFBytes(view, offset, string) {
        var lng = string.length;
        for (var i = 0; i < lng; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // creates the audio context
    var audioContext = Storage.AudioContext;

    if (!Storage.AudioContextConstructor)
        Storage.AudioContextConstructor = new audioContext();

    var context = Storage.AudioContextConstructor;

    // creates a gain node
    if (!Storage.VolumeGainNode)
        Storage.VolumeGainNode = context.createGain();

    var volume = Storage.VolumeGainNode;

    // creates an audio node from the microphone incoming stream
    if (!Storage.AudioInput)
        Storage.AudioInput = context.createMediaStreamSource(mediaStream);

    var audioInput = Storage.AudioInput;

    // connect the stream to the gain node
    audioInput.connect(volume);

    // From the spec: This value controls how frequently the audioprocess event is 
    // dispatched and how many sample-frames need to be processed each call. 
    // Lower values for buffer size will result in a lower (better) latency. 
    // Higher values will be necessary to avoid audio breakup and glitches

    // bug: how to minimize wav size?
    // workaround? obviously ffmpeg!

    // The size of the buffer (in sample-frames) which needs to 
    // be processed each time onprocessaudio is called. 
    // Legal values are (256, 512, 1024, 2048, 4096, 8192, 16384). 
    var legalBufferValues = [256, 512, 1024, 2048, 4096, 8192, 16384];
    var bufferSize = root.bufferSize || 4096;

    if (legalBufferValues.indexOf(bufferSize) == -1) {
        throw 'Legal values for buffer-size are ' + JSON.stringify(legalBufferValues, null, '\t');
    }

    // The sample rate (in sample-frames per second) at which the 
    // AudioContext handles audio. It is assumed that all AudioNodes 
    // in the context run at this rate. In making this assumption, 
    // sample-rate converters or "varispeed" processors are not supported 
    // in real-time processing.

    // The sampleRate parameter describes the sample-rate of the 
    // linear PCM audio data in the buffer in sample-frames per second. 
    // An implementation must support sample-rates in at least 
    // the range 22050 to 96000.
    var sampleRate = root.sampleRate || context.sampleRate || 44100;

    if (sampleRate < 22050 || sampleRate > 96000) {
        throw 'sample-rate must be under range 22050 and 96000.';
    }

    console.log('sample-rate', sampleRate);
    console.log('buffer-size', bufferSize);

    if (context.createJavaScriptNode) {
        __stereoAudioRecorderJavacriptNode = context.createJavaScriptNode(bufferSize, 2, 2);
    } else if (context.createScriptProcessor) {
        __stereoAudioRecorderJavacriptNode = context.createScriptProcessor(bufferSize, 2, 2);
    } else {
        throw 'WebAudio API has no support on this browser.';
    }

    var isAudioProcessStarted = false,
        self = this;
    __stereoAudioRecorderJavacriptNode.onaudioprocess = function (e) {
        // if MediaStream().stop() or MediaStreamTrack().stop() is invoked.
        if (mediaStream.ended) {
            __stereoAudioRecorderJavacriptNode.onaudioprocess = function () {};
            return;
        }

        if (!recording) return;

        if (!isAudioProcessStarted) {
            isAudioProcessStarted = true;
            if (self.onAudioProcessStarted) {
                self.onAudioProcessStarted();
            }
        }

        var left = e.inputBuffer.getChannelData(0);
        var right = e.inputBuffer.getChannelData(1);

        // we clone the samples
        leftchannel.push(new Float32Array(left));
        rightchannel.push(new Float32Array(right));

        recordingLength += bufferSize;
    };

    // we connect the recorder
    volume.connect(__stereoAudioRecorderJavacriptNode);

    // to prevent self audio to be connected with speakers
    __stereoAudioRecorderJavacriptNode.connect(context.destination);
}


// _________________
// WhammyRecorder.js

function WhammyRecorder(mediaStream) {
    this.record = function () {
        if (!this.width) this.width = video.offsetWidth || 320;
        if (!this.height) this.height = video.offsetHeight || 240;

        if (!this.video) {
            this.video = {
                width: this.width,
                height: this.height
            };
        }

        if (!this.canvas) {
            this.canvas = {
                width: this.width,
                height: this.height
            };
        }

        canvas.width = this.canvas.width;
        canvas.height = this.canvas.height;

        video.width = this.video.width;
        video.height = this.video.height;

        console.log('canvas width', canvas.width);
        console.log('canvas height', canvas.height);

        console.log('video width', video.width);
        console.log('video height', video.height);

        context = canvas.getContext('2d');

        drawFrames();
    };

    var frames = [];

    // if user want to display advertisement before recorded video!
    if (this.advertisement) {
        frames = advertisement;
    }

    function drawFrames() {
        var duration = new Date().getTime() - lastTime;
        if (!duration) return drawFrames();

        // via #206, by Jack i.e. @Seymourr
        lastTime = new Date().getTime();

        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({
            duration: duration,
            image: canvas.toDataURL('image/webp')
        });

        if (!isStopDrawing) {
            setTimeout(drawFrames, 10);
        }
    }

    var isStopDrawing = false;

    this.stop = function (callback) {
        isStopDrawing = true;
        whammy.frames = dropFirstFrame(frames);
        frames = [];

        this.recordedBlob = whammy.compile();

        if (callback) callback(this.recordedBlob);
    };

    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');

    var video = document.createElement('video');
    video.muted = true;
    video.volume = 0;
    video.autoplay = true;
    video.src = URL.createObjectURL(mediaStream);
    video.play();

    var lastTime = new Date().getTime();

    var whammy = new Whammy.Video();
}

// https://github.com/antimatter15/whammy/blob/master/LICENSE
// _________
// Whammy.js

// todo: Firefox now supports webp for webm containers!
// their MediaRecorder implementation works well!
// should we provide an option to record via Whammy.js or MediaRecorder API is a better solution?

var Whammy = (function () {

    function toWebM(frames) {
        var info = checkFrames(frames);

        var CLUSTER_MAX_DURATION = 30000;

        var EBML = [{
            "id": 0x1a45dfa3, // EBML
            "data": [{
                "data": 1,
                "id": 0x4286 // EBMLVersion
            }, {
                "data": 1,
                "id": 0x42f7 // EBMLReadVersion
            }, {
                "data": 4,
                "id": 0x42f2 // EBMLMaxIDLength
            }, {
                "data": 8,
                "id": 0x42f3 // EBMLMaxSizeLength
            }, {
                "data": "webm",
                "id": 0x4282 // DocType
            }, {
                "data": 2,
                "id": 0x4287 // DocTypeVersion
            }, {
                "data": 2,
                "id": 0x4285 // DocTypeReadVersion
            }]
        }, {
            "id": 0x18538067, // Segment
            "data": [{
                "id": 0x1549a966, // Info
                "data": [{
                    "data": 1e6, //do things in millisecs (num of nanosecs for duration scale)
                    "id": 0x2ad7b1 // TimecodeScale
                }, {
                    "data": "whammy",
                    "id": 0x4d80 // MuxingApp
                }, {
                    "data": "whammy",
                    "id": 0x5741 // WritingApp
                }, {
                    "data": doubleToString(info.duration),
                    "id": 0x4489 // Duration
                }]
            }, {
                "id": 0x1654ae6b, // Tracks
                "data": [{
                    "id": 0xae, // TrackEntry
                    "data": [{
                        "data": 1,
                        "id": 0xd7 // TrackNumber
                    }, {
                        "data": 1,
                        "id": 0x63c5 // TrackUID
                    }, {
                        "data": 0,
                        "id": 0x9c // FlagLacing
                    }, {
                        "data": "und",
                        "id": 0x22b59c // Language
                    }, {
                        "data": "V_VP8",
                        "id": 0x86 // CodecID
                    }, {
                        "data": "VP8",
                        "id": 0x258688 // CodecName
                    }, {
                        "data": 1,
                        "id": 0x83 // TrackType
                    }, {
                        "id": 0xe0, // Video
                        "data": [{
                            "data": info.width,
                            "id": 0xb0 // PixelWidth
                        }, {
                            "data": info.height,
                            "id": 0xba // PixelHeight
                        }]
                    }]
                }]
            }]
        }];

        //Generate clusters (max duration)
        var frameNumber = 0;
        var clusterTimecode = 0;
        while (frameNumber < frames.length) {

            var clusterFrames = [];
            var clusterDuration = 0;
            do {
                clusterFrames.push(frames[frameNumber]);
                clusterDuration += frames[frameNumber].duration;
                frameNumber++;
            } while (frameNumber < frames.length && clusterDuration < CLUSTER_MAX_DURATION);

            var clusterCounter = 0;
            var cluster = {
                "id": 0x1f43b675, // Cluster
                "data": [{
                    "data": clusterTimecode,
                    "id": 0xe7 // Timecode
                }].concat(clusterFrames.map(function (webp) {
                    var block = makeSimpleBlock({
                        discardable: 0,
                        frame: webp.data.slice(4),
                        invisible: 0,
                        keyframe: 1,
                        lacing: 0,
                        trackNum: 1,
                        timecode: Math.round(clusterCounter)
                    });
                    clusterCounter += webp.duration;
                    return {
                        data: block,
                        id: 0xa3
                    };
                }))
            }; //Add cluster to segment
            EBML[1].data.push(cluster);
            clusterTimecode += clusterDuration;
        }

        return generateEBML(EBML);
    }

    // sums the lengths of all the frames and gets the duration

    function checkFrames(frames) {
        if (!frames[0]) {
            console.warn('Something went wrong. Maybe WebP format is not supported in the current browser.');
            return;
        }

        var width = frames[0].width,
            height = frames[0].height,
            duration = frames[0].duration;

        for (var i = 1; i < frames.length; i++) {
            duration += frames[i].duration;
        }
        return {
            duration: duration,
            width: width,
            height: height
        };
    }

    function numToBuffer(num) {
        var parts = [];
        while (num > 0) {
            parts.push(num & 0xff);
            num = num >> 8;
        }
        return new Uint8Array(parts.reverse());
    }

    function strToBuffer(str) {
        return new Uint8Array(str.split('').map(function (e) {
            return e.charCodeAt(0);
        }));
    }

    function bitsToBuffer(bits) {
        var data = [];
        var pad = (bits.length % 8) ? (new Array(1 + 8 - (bits.length % 8))).join('0') : '';
        bits = pad + bits;
        for (var i = 0; i < bits.length; i += 8) {
            data.push(parseInt(bits.substr(i, 8), 2));
        }
        return new Uint8Array(data);
    }

    function generateEBML(json) {
        var ebml = [];
        for (var i = 0; i < json.length; i++) {
            var data = json[i].data;
            if (typeof data == 'object') data = generateEBML(data);
            if (typeof data == 'number') data = bitsToBuffer(data.toString(2));
            if (typeof data == 'string') data = strToBuffer(data);

            var len = data.size || data.byteLength || data.length;
            var zeroes = Math.ceil(Math.ceil(Math.log(len) / Math.log(2)) / 8);
            var size_str = len.toString(2);
            var padded = (new Array((zeroes * 7 + 7 + 1) - size_str.length)).join('0') + size_str;
            var size = (new Array(zeroes)).join('0') + '1' + padded;

            ebml.push(numToBuffer(json[i].id));
            ebml.push(bitsToBuffer(size));
            ebml.push(data);
        }

        return new Blob(ebml, {
            type: "video/webm"
        });
    }

    function toBinStr_old(bits) {
        var data = '';
        var pad = (bits.length % 8) ? (new Array(1 + 8 - (bits.length % 8))).join('0') : '';
        bits = pad + bits;
        for (var i = 0; i < bits.length; i += 8) {
            data += String.fromCharCode(parseInt(bits.substr(i, 8), 2));
        }
        return data;
    }

    function generateEBML_old(json) {
        var ebml = '';
        for (var i = 0; i < json.length; i++) {
            var data = json[i].data;
            if (typeof data == 'object') data = generateEBML_old(data);
            if (typeof data == 'number') data = toBinStr_old(data.toString(2));

            var len = data.length;
            var zeroes = Math.ceil(Math.ceil(Math.log(len) / Math.log(2)) / 8);
            var size_str = len.toString(2);
            var padded = (new Array((zeroes * 7 + 7 + 1) - size_str.length)).join('0') + size_str;
            var size = (new Array(zeroes)).join('0') + '1' + padded;

            ebml += toBinStr_old(json[i].id.toString(2)) + toBinStr_old(size) + data;

        }
        return ebml;
    }

    function makeSimpleBlock(data) {
        var flags = 0;
        if (data.keyframe) flags |= 128;
        if (data.invisible) flags |= 8;
        if (data.lacing) flags |= (data.lacing << 1);
        if (data.discardable) flags |= 1;
        if (data.trackNum > 127) {
            throw "TrackNumber > 127 not supported";
        }
        var out = [data.trackNum | 0x80, data.timecode >> 8, data.timecode & 0xff, flags].map(function (e) {
            return String.fromCharCode(e);
        }).join('') + data.frame;

        return out;
    }

    function parseWebP(riff) {
        var VP8 = riff.RIFF[0].WEBP[0];

        var frame_start = VP8.indexOf('\x9d\x01\x2a'); // A VP8 keyframe starts with the 0x9d012a header
        for (var i = 0, c = []; i < 4; i++) c[i] = VP8.charCodeAt(frame_start + 3 + i);

        var width, height, tmp;

        //the code below is literally copied verbatim from the bitstream spec
        tmp = (c[1] << 8) | c[0];
        width = tmp & 0x3FFF;
        tmp = (c[3] << 8) | c[2];
        height = tmp & 0x3FFF;
        return {
            width: width,
            height: height,
            data: VP8,
            riff: riff
        };
    }

    function parseRIFF(string) {
        var offset = 0;
        var chunks = {};

        while (offset < string.length) {
            var id = string.substr(offset, 4);
            var len = parseInt(string.substr(offset + 4, 4).split('').map(function (i) {
                var unpadded = i.charCodeAt(0).toString(2);
                return (new Array(8 - unpadded.length + 1)).join('0') + unpadded;
            }).join(''), 2);
            var data = string.substr(offset + 4 + 4, len);
            offset += 4 + 4 + len;
            chunks[id] = chunks[id] || [];

            if (id == 'RIFF' || id == 'LIST') {
                chunks[id].push(parseRIFF(data));
            } else {
                chunks[id].push(data);
            }
        }
        return chunks;
    }

    function doubleToString(num) {
        return [].slice.call(
            new Uint8Array((new Float64Array([num])).buffer), 0).map(function (e) {
            return String.fromCharCode(e);
        }).reverse().join('');
    }

    // a more abstract-ish API

    function WhammyVideo(duration) {
        this.frames = [];
        this.duration = duration || 1;
        this.quality = 100;
    }

    WhammyVideo.prototype.add = function (frame, duration) {
        if ('canvas' in frame) { //CanvasRenderingContext2D
            frame = frame.canvas;
        }

        if ('toDataURL' in frame) {
            frame = frame.toDataURL('image/webp', this.quality);
        }

        if (!(/^data:image\/webp;base64,/ig).test(frame)) {
            throw "Input must be formatted properly as a base64 encoded DataURI of type image/webp";
        }
        this.frames.push({
            image: frame,
            duration: duration || this.duration
        });
    };
    WhammyVideo.prototype.compile = function () {
        return new toWebM(this.frames.map(function (frame) {
            var webp = parseWebP(parseRIFF(atob(frame.image.slice(23))));
            webp.duration = frame.duration;
            return webp;
        }));
    };
    return {
        Video: WhammyVideo,
        toWebM: toWebM
    };
})();

// This method is taken from a modified version of MediaStreamRecorder.js!
// To solve first frame that is always blank. 
// See: https://github.com/muaz-khan/WebRTC-Experiment/issues/94

function dropFirstFrame(arr) {
    arr.shift();
    return arr;
}

if (location.href.indexOf('file:') == 0) {
    console.error('Please load this HTML file on HTTP or HTTPS.');
}

// below function via: http://goo.gl/B3ae8c
function bytesToSize(bytes) {
    var k = 1000;
    var sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(k)), 10);
    return (bytes / Math.pow(k, i)).toPrecision(3) + ' ' + sizes[i];
}
