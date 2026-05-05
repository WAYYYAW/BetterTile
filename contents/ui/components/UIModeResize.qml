import QtQuick

Rectangle {
    id: modeResize
    color: "transparent"
    anchors.fill: parent
    visible: false
    focus: true

    property var overlayGeometry: undefined
    property var theme: ({})
    property var resizeObj: undefined

    Keys.onPressed: function(event) {
        if (!resizeObj || !resizeObj.active) return;

        switch (event.key) {
            case Qt.Key_Right:
                resizeObj.increaseWidth();
                break;
            case Qt.Key_Left:
                resizeObj.decreaseWidth();
                break;
            case Qt.Key_Up:
                resizeObj.increaseHeight();
                break;
            case Qt.Key_Down:
                resizeObj.decreaseHeight();
                break;
            case Qt.Key_Escape:
            case Qt.Key_Return:
            case Qt.Key_Enter:
                resizeObj.deactivate();
                break;
            default:
                return;
        }
        event.accepted = true;
    }

    Rectangle {
        id: frame
        visible: overlayGeometry !== undefined
        x: overlayGeometry ? overlayGeometry.x : 0
        y: overlayGeometry ? overlayGeometry.y : 0
        width: overlayGeometry ? overlayGeometry.width : 0
        height: overlayGeometry ? overlayGeometry.height : 0
        color: "transparent"
        border.color: theme.resizeBorder || "#4a9eff"
        border.width: 3
        radius: theme.radius || 4

        Rectangle {
            anchors.horizontalCenter: parent.horizontalCenter
            y: Math.max(-24, -parent.y)
            width: label.width + 16
            height: 22
            color: theme.resizeBorder || "#4a9eff"
            radius: 4
            visible: parent.visible

            Text {
                id: label
                anchors.centerIn: parent
                text: "RESIZE"
                color: "#ffffff"
                font.pixelSize: 12
                font.bold: true
            }
        }
    }
}
