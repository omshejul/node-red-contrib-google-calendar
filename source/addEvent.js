var request = require("request");
module.exports = function (RED) {
  "use strict";
  function addEvent(n) {
    RED.nodes.createNode(this, n);
    this.google = RED.nodes.getNode(n.google);
    if (!this.google || !this.google.credentials.accessToken) {
      this.warn(RED._("calendar.warn.no-credentials"));
      return;
    }
    var calendarId = n.calendarId2 || "";
    var node = this;

    node.on("input", function (msg) {
      calendarId = msg.calendarId ? msg.calendarId : calendarId;
      var title = msg.title ? msg.title : n.title;
      var description = msg.description ? msg.description : n.description;
      var location = msg.location ? msg.location : n.location;

      var timeStart = msg.start ? msg.start : n.time.split(" - ")[0];
      var timeEnd = msg.end ? msg.end : n.time.split(" - ")[1];

      // Use a new variable for attendees, prioritize msg.arrAttend if it exists
      var attendees = Array.isArray(msg.arrAttend) ? msg.arrAttend : [];

      // Only process node configuration attendees if msg.arrAttend is not provided
      if (attendees.length === 0 && n.attend > 0) {
        for (let index = 1; index <= parseInt(n.attend); index++) {
          if (n["email" + index] && validateEmail(n["email" + index])) {
            attendees.push({
              email: n["email" + index],
              displayName: n["name" + index] || "",
            });
          }
        }
      }

      var event = {
        summary: title,
        description: description,
        location: location,
        start: { dateTime: new Date(timeStart).toISOString() },
        end: { dateTime: new Date(timeEnd).toISOString() },
        attendees: attendees,
      };
      var linkUrl =
        "https://www.googleapis.com/calendar/v3/calendars/" +
        encodeURIComponent(calendarId) +
        "/events?sendUpdates=all";
      var opts = {
        method: "POST",
        url: linkUrl,
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + node.google.credentials.accessToken,
        },
        body: JSON.stringify(event),
      };
      request(opts, function (error, response, body) {
        if (error) {
          node.error(error, {});
          node.status({
            fill: "red",
            shape: "ring",
            text: "calendar.status.failed",
          });
          return;
        }
        msg.payload = JSON.parse(body);
        node.send(msg);
      });
    });
  }
  RED.nodes.registerType("addEvent", addEvent);

  function validateEmail(email) {
    var re = /\S+@\S+\.\S+/;
    return re.test(email);
  }

  RED.httpAdmin.get("/cal", function (req, res) {
    var googleId = res.socket.parser.incoming._parsedUrl.path.split("id=")[1];
    RED.nodes
      .getNode(googleId)
      .request(
        "https://www.googleapis.com/calendar/v3/users/me/calendarList",
        function (err, data) {
          if (err) return;

          var primary = "";
          var arrCalendar = [];

          for (var i = 0; i < data.items.length; i++) {
            var cal = data.items[i];
            if (cal.primary) {
              primary = cal.id;
            } else {
              arrCalendar.push(cal.id);
            }
          }

          var arrData = [];
          arrData.push(primary);
          arrCalendar.sort();
          arrCalendar.forEach(function (element) {
            arrData.push(element);
          });
          res.json(arrData);
        }
      );
  });
};
